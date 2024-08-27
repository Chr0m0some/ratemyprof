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
  const data = await req.json();
  const pc = new Pinecone({
    apiKey: process.env.PINECONE_API_KEY,
  });
  const index = pc.index("rag").namespace("ns1");
  const text = data[data.length - 1].content;
  const embedding = await inference.featureExtraction({
    model: "dunzhang/stella_en_1.5B_v5",
    inputs: text,
  });
    console.log(embedding)
  const results = await index.query({
    topK: 3,
    includeMetadata: true,
    vector: embedding,
  });

  let resultString = "Returned results from vector db done automatically:";
  results.matches.forEach((match) => {
    resultString += `\n
    Professor: ${match.id}
    Review: ${match.metadata.review}
    Subject: ${match.metadata.subject}
    Stars: ${match.metadata.stars}
    \n\n
    `;
  });

  const lastMessage = data[data.length - 1];
  const lastMessageContent = lastMessage.content + resultString;
  const lastDataWithoutLastMessage = data.slice(0, data.length - 1);

  let completion = "";
  for await (const chunk of inference.chatCompletionStream({
    model: "mistralai/Mistral-7B-Instruct-v0.2",
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: lastMessageContent,
      },
      ...lastDataWithoutLastMessage,
    ],
    max_tokens: 1000,
  })) {
    if (chunk.choices && chunk.choices.length > 0) {
      completion += chunk.choices[0].delta.content;
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
  // console.log('finished loading')
  return new NextResponse(stream);
}
