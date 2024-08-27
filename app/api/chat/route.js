import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { inference } from "@/app/utils/hf";

const systemPrompt = `You are an AI assistant for a RateMyProfessor-like service. Your role is to help students find suitable professors based on their queries using a Retrieval-Augmented Generation (RAG) system. For each user question, you will be provided with information about the top 3 professors that best match the query.

Your tasks are to:

1. Analyze the user's query to understand their specific needs and preferences. 
2. Review the information provided about the top 3 professors.
3. Present a summary of each professor's strengths and potential drawbacks based on the retrieved information.
4. Offer a recommendation on which professor might be the best fit, explaining your reasoning.
5. If applicable, suggest follow-up questions the student might want to consider.

When responding:
- Be objective and balanced in your assessments.
- Do not repeat the user's query to them and make up a name for them.
- Use the specific information provided about each professor.
- Avoid making comparisons to professors not mentioned in the retrieved information.
- If the user's query doesn't align well with the retrieved professor information, acknowledge this and suggest how they might refine their search.
- Be respectful and professional when discussing professors and their teaching styles.
- If asked about details not provided in the retrieved information, clearly state that you don't have that specific information.

Remember, your goal is to assist students in making informed decisions about their education while relying on the information provided through the RAG system. Always encourage students to do additional research and consider multiple factors when choosing a professor.`;

export async function POST(req) {
  try {
    const data = await req.json();
    console.log(data)
    const batchSize = 5; // Define your batch size
    const batches = [];
    
    // Create batches of messages
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      batches.push(batch);
    }

    let completion = "";
    
    for (const batch of batches) {
      const lastMessageContent = batch[batch.length - 1].content; // Get the last message content
      const lastDataWithoutLastMessage = batch.slice(0, batch.length - 1);

      // Extract embedding for the last message content
      const embedding = await inference.featureExtraction({
        model: "dunzhang/stella_en_1.5B_v5",
        inputs: lastMessageContent,
      });

      // Query Pinecone with the extracted embedding
      const results = await index.query({
        topK: 3,
        includeMetadata: true,
        vector: embedding,
      });

      // Construct a result string from the query results
      let resultString = "Returned results from vector db:";
      results.matches.forEach((match) => {
        resultString += `\nProfessor: ${match.id}\nReview: ${match.metadata.review}\nSubject: ${match.metadata.subject}\nStars: ${match.metadata.stars}\n`;
      });

      // Combine the result string with the last message content
      const augmentedMessageContent = lastMessageContent + resultString;

      const response = await inference.chatCompletionStream({
        model: "mistralai/Mistral-7B-Instruct-v0.2",
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: augmentedMessageContent,
          },
          ...lastDataWithoutLastMessage,
        ],
        max_tokens: 1000,
      });

      for await (const chunk of response) {
        if (chunk.choices && chunk.choices.length > 0) {
          completion += chunk.choices[0].delta.content;
        }
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        try {
          if (completion) {
            const text = encoder.encode(completion);
            controller.enqueue(text);
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream);
  } catch (error) {
    console.error("Error in POST:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
