import { createThirdwebClient, getContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";

interface Env {
  AI: {
    run(model: string, inputs: Record<string, any>): Promise<Response>;
  };
}

interface UpdateBody {
  tokenId: string;
  updateData: Record<string, any>;
  path?: 'A' | 'B' | 'C';
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleUpdate(request, env);
  },
};

const client = createThirdwebClient({
  clientId: "e24d90c806dc62cef0745af3ddd76314",
});

const contract = getContract({
  client,
  chain: defineChain(10), // Optimism Mainnet
  address: "0x9B4A8c5C1452bF204B65C7DDbe202E7A3c79cF3D",
});

async function handleUpdate(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const body: UpdateBody = await request.json();
    const { tokenId, updateData, path } = bodyValidation(body);

    let newImageUri = "";
    if (path) {
      newImageUri = await generateImage(env, path);
    }

    const updatedMetadata = await updateNFTMetadata(contract, tokenId, updateData, newImageUri);

    return new Response(JSON.stringify({ success: true, updatedMetadata }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error: any) {
    console.error('Update Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status || 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

async function generateImage(env: Env, path: 'A' | 'B' | 'C'): Promise<string> {
  const prompt = `Generate an artistic image for path ${path}, highly detailed, cyberpunk style`;
  const inputs = {
    prompt,
    negative_prompt: "blurry, distorted, low quality",
  };

  const response = await env.AI.run("@cf/stabilityai/stable-diffusion-xl-base-1.0", inputs);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI Image generation failed: ${errorText}`);
  }

  const imageBuffer = await response.arrayBuffer();
  const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
  return `data:image/png;base64,${base64Image}`;
}

async function updateNFTMetadata(
  nftContract: any,
  tokenId: string,
  updateData: Record<string, any>,
  newImageUri: string
): Promise<Record<string, any>> {
  try {
    const currentMetadata = await nftContract.metadata.get(tokenId);
    const updatedMetadata = {
      ...currentMetadata,
      ...updateData,
      ...(newImageUri ? { image: newImageUri } : {})
    };

    await nftContract.metadata.update(tokenId, updatedMetadata);

    return updatedMetadata;
  } catch (error: any) {
    throw new Error(`Metadata update failed: ${error.message}`);
  }
}

function bodyValidation(body: any): UpdateBody {
  const { tokenId, updateData, path } = body;
  if (!tokenId || !updateData) {
    throw Object.assign(new Error('tokenId and updateData are required'), { status: 400 });
  }
  return { tokenId, updateData, path };
}