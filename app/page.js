"use client";
import { Stack, Box, Button, TextField } from "@mui/material";
import { useState } from "react";
export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hi! I'm the Rate my Professor support assistant. How can I help you today?",
    },
  ]);
  const [message, setMessage] = useState("");

  const sendMessage = async () => {
    setMessage("");
    setMessages((messages) => [
      ...messages,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ]);
    const response = fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify([...messages, { roles: "user", content: message }]),
    }).then(async (res) => {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let result = "";
      return reader.read().then(function processText({ done, value }) {
        if (done) {
          return result;
        }
        const text = decoder.decode(value || new Uint8Array(), {
          stream: true,
        });
        setMessages((messages) => {
          let lastMessage = messages[messages.length - 1];
          let otherMessages = messages.slice(0, messages.length - 1);
          return [
            ...otherMessages,
            { ...lastMessage, content: lastMessage.content + text },
          ];
        });

        return reader.read().then(processText);
      });
    });
  };
  // console.log("Messages:", messages);
  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      sx={{ backgroundImage: 'url(/background1.jpg)', backgroundSize: 'cover' }}
    >

      <h1 className="multicolor-text">Rate My Professor</h1>
      <Stack
        direction={"column"}
        width="500px"
        height="700px"
        border="1px solid black"
        p={2}
        spacing={3}
        borderRadius={8}
        sx={{
          boxShadow: '0px 4px 20px rgba(255, 105, 180, 0.5), 0px 0px 10px rgba(128, 0, 128, 0.3)', 
          mt: 4
        }}
      >
        <Stack
          direction={"column"}
          spacing={2}
          flexGrow={1}
          overflow="auto"
          maxHeight="100%"
        >
          {messages.map((message, index) => (
            <Box
              key={index}
              display="flex"
              justifyContent={
                message.role === "assistant" ? "flex-start" : "flex-end"
              }
            >
              <Box
                bgcolor={
                  message.role === 'assistant'
                    ? 'rgba(30, 144, 255, 0.2)'  
                    : 'rgba(156, 39, 176, 0.2)' 
                }
                color="white"
                borderRadius={16}
                p={3}
              >
                {message.content}
              </Box>
            </Box>
          ))}
        </Stack>
        <Stack direction={"row"} spacing={2}>
          <TextField
            label="Message..."
            fullWidth
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  borderColor: '#1876d2', // Border color when the field is not focused
                },
                '&:hover fieldset': {
                  borderColor: '#1876d2', // Border color when the field is hovered
                },
                '&.Mui-focused fieldset': {
                  borderColor: '#1876d2', // Border color when the field is focused
                },
              },
              '& .MuiInputLabel-root': {
                color: '#1876d2', // Label color
              },
              '& .MuiInputBase-input': {
                color: '#1876d2', // Input text color
              }
            }}
          />
          <Button variant="contained" onClick={sendMessage}>
            Send
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
