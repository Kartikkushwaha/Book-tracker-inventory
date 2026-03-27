import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface Book {
  title: string;
  author?: string;
  category: string;
}

export const analyzeImages = async (base64Images: string[]): Promise<Book[]> => {
  const model = "gemini-3-flash-preview";
  
  const prompt = `Analyze these images of books. Extract the FULL title (including any subtitles) and author for each book you see across ALL provided images. 
  IMPORTANT: If the same book appears in multiple images, only include it ONCE in the final list.
  Ensure titles are complete and accurate as they appear on the cover or spine.
  Categorize each book into one of these categories: Fiction, Non-fiction, Science, Technology, Self-help, Academic, or Others.
  Return a SINGLE JSON array of unique objects with 'title', 'author', and 'category' fields.`;

  const contents = {
    parts: [
      { text: prompt },
      ...base64Images.map(data => ({
        inlineData: {
          mimeType: "image/jpeg",
          data: data.split(',')[1] || data
        }
      }))
    ]
  };

  try {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              author: { type: Type.STRING },
              category: { 
                type: Type.STRING,
                enum: ["Fiction", "Non-fiction", "Science", "Technology", "Self-help", "Academic", "Others"]
              }
            },
            required: ["title", "category"]
          }
        }
      }
    });

    const text = response.text;
    return JSON.parse(text);
  } catch (error) {
    console.error("Error analyzing images:", error);
    return [];
  }
};

export const getBookDetails = async (title: string, author?: string): Promise<string> => {
  const model = "gemini-3-flash-preview";
  const query = `Provide a short review of the book "${title}"${author ? ` by ${author}` : ""}. 
  Include its theme, goal, scope, author background, and public rating if available. 
  Keep it concise and professional. Use Markdown for formatting.`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: query,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    return response.text || "No details found.";
  } catch (error) {
    console.error("Error fetching book details:", error);
    return "Error fetching details.";
  }
};
