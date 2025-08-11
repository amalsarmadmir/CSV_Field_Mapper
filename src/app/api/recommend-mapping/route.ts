import { NextRequest } from "next/server";
import { pipeline } from "@xenova/transformers";

let embedder: any = null;

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, ai, i) => sum + ai * b[i], 0);
  const magA = Math.sqrt(a.reduce((sum, ai) => sum + ai * ai, 0));
  const magB = Math.sqrt(b.reduce((sum, bi) => sum + bi * bi, 0));
  return dot / (magA * magB);
}

export async function POST(req: NextRequest) {
  try {
    const { csv1Fields, csv2Fields } = await req.json();

    if (!Array.isArray(csv1Fields) || !Array.isArray(csv2Fields)) {
      return new Response(JSON.stringify({ error: "Invalid input arrays" }), {
        status: 400,
      });
    }

    if (!embedder) {
      embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    }

    const allFields = [...csv1Fields, ...csv2Fields];

    const embeddings: number[][] = [];

    for (const field of allFields) {
      const output = await embedder(field);
      const flatVector = output[0][0].data; 
      embeddings.push(Array.from(flatVector));
    }

    const recommendations: Record<string, { bestMatch: string; score: number }> = {};

    for (let i = 0; i < csv1Fields.length; i++) {
      const sourceEmbedding = embeddings[i];
      let bestScore = -1;
      let bestMatch = "";

      for (let j = csv1Fields.length; j < embeddings.length; j++) {
        const targetEmbedding = embeddings[j];
        const score = cosineSimilarity(sourceEmbedding, targetEmbedding);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = allFields[j];
        }
      }

      recommendations[csv1Fields[i]] = {
        bestMatch,
        score: parseFloat(bestScore.toFixed(4)),
      };
    }

    return new Response(JSON.stringify({ recommendations }), {
      status: 200,
    });
  } catch (error) {
    console.error("Embedding error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
    });
  }
}
