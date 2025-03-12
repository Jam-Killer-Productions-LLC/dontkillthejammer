// src/index.ts
import { ThirdwebSDK } from "@thirdweb-dev/sdk";

interface Env {
  THIRDWEB_NETWORK: string;
  NFT_CONTRACT_ADDRESS: string;
  THIRDWEB_SECRET_KEY?: string;
  AI: {
    run: (model: string, inputs: Record<string, any>) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(request.url);
      const { pathname } = url;
      if (pathname.startsWith("/nft/update")) {
        return await handleUpdate(request, env);
      }
      return new Response("Not Found", { status: 404 });
    } catch (error) {
      console.error("Error handling request:", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
};

async function handleUpdate(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const body = await request.json();
    const { tokenId, updateData, path } = body;
    if (!tokenId || !updateData) {
      return new Response(
        JSON.stringify({ error: "Missing parameters. Required: tokenId and updateData" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    let sdkInstance: ThirdwebSDK;
    if (env.THIRDWEB_SECRET_KEY) {
      sdkInstance = ThirdwebSDK.fromPrivateKey(env.THIRDWEB_SECRET_KEY, env.THIRDWEB_NETWORK, {
        secretKey: env.THIRDWEB_SECRET_KEY,
      });
    } else {
      sdkInstance = new ThirdwebSDK(env.THIRDWEB_NETWORK);
    }

    const nftContract = await sdkInstance.getContract(env.NFT_CONTRACT_ADDRESS);
    let newImageUri: string | undefined;
    if (path && ["A", "B", "C"].includes(path)) {
      const sdInputs = {
        prompt: `A dystopian cyberpunk scene for path ${path}, highly detailed, cinematic lighting, 8k resolution`,
        negative_prompt: "blurry, low quality, distorted, deformed",
      };

      const sdResp = await env.AI.run("@cf/stabilityai/stable-diffusion-xl-base-1.0", sdInputs);
      if (!sdResp.ok) {
        const errorText = await sdResp.text();
        throw new Error(`Image generation failed: ${errorText}`);
      }
      const imageBuffer = await sdResp.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      newImageUri = `data:image/png;base64,${base64Image}`;
    }

    const currentMetadata = await nftContract.metadata.get(tokenId);
    const updatedMetadata = { ...currentMetadata, ...updateData };
    if (newImageUri) {
      updatedMetadata.image = newImageUri;
    }

    const updateTx = await nftContract.metadata.update(tokenId, updatedMetadata);
    return new Response(
      JSON.stringify({
        message: "NFT updated successfully",
        data: { tokenId, updateTx, updatedMetadata },
      }),
      {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error updating NFT:", error);
    return new Response(
      JSON.stringify({ error: "Error updating NFT", message: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }
}