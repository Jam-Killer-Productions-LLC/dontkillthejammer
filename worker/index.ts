import { createThirdwebClient, getContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";

// Define your environment interface. 
// If you no longer need AI for image generation, you can remove it.
interface Env {
  // AI binding can be removed if not needed for this worker.
  AI: Ai;
}

// Define the expected request body.
interface UpdateBody {
  tokenId: string;
  updateData: Record<string, any>;
}

// Export the handler that processes the NFT update request.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleUpdate(request, env);
  },
} satisfies ExportedHandler<Env>;

// Initialize the Thirdweb client and NFT contract.
const client = createThirdwebClient({
  clientId: "e24d90c806dc62cef0745af3ddd76314",
});

const contract = getContract({
  client,
  chain: defineChain(10), // Optimism Mainnet
  address: "0x9B4A8c5C1452bF204B65C7DDbe202E7A3c79cF3D",
});

// Main function to handle update requests.
async function handleUpdate(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const body: UpdateBody = await request.json();
    const { tokenId, updateData } = bodyValidation(body);

    // Update NFT metadata on-chain using the provided updateData.
    const updatedMetadata = await updateNFTMetadata(contract, tokenId, updateData);

    return new Response(
      JSON.stringify({ success: true, updatedMetadata }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error: any) {
    console.error("Update Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.status || 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
}

// Function to update NFT metadata via the Thirdweb contract.
async function updateNFTMetadata(
  nftContract: any,
  tokenId: string,
  updateData: Record<string, any>
): Promise<Record<string, any>> {
  try {
    const currentMetadata = await nftContract.metadata.get(tokenId);
    const updatedMetadata = {
      ...currentMetadata,
      ...updateData,
    };

    await nftContract.metadata.update(tokenId, updatedMetadata);

    return updatedMetadata;
  } catch (error: any) {
    throw new Error(`Metadata update failed: ${error.message}`);
  }
}

// Basic validation for the request body.
function bodyValidation(body: any): UpdateBody {
  const { tokenId, updateData } = body;
  if (!tokenId || !updateData) {
    throw Object.assign(new Error("tokenId and updateData are required"), { status: 400 });
  }
  return { tokenId, updateData };
}