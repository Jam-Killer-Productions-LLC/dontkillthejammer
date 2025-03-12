async function handleUpdate(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const body = await request.json();
    const { tokenId, updateData, path } = body;
    
    if (!tokenId || !updateData) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Initialize ThirdWeb SDK
    let sdk;
    if (env.THIRDWEB_SECRET_KEY) {
      // Use private key if available for server-side operations
      sdk = ThirdwebSDK.fromPrivateKey(
        env.THIRDWEB_SECRET_KEY,
        env.THIRDWEB_NETWORK,
        {
          secretKey: env.THIRDWEB_SECRET_KEY,
        }
      );
    } else {
      // Fallback to regular initialization
      sdk = new ThirdwebSDK(env.THIRDWEB_NETWORK);
    }
    
    // Get contract reference
    const nftContract = await sdk.getContract(env.NFT_CONTRACT_ADDRESS);
    
    // If path is provided and different, generate a new image
    let newImageUri;
    if (path && ['A', 'B', 'C'].includes(path)) {
      // Generate new image with Stable Diffusion
      console.log('Generating new image for path:', path);
      const sdInputs = { 
        prompt: `A dystopian cyberpunk scene for path ${path}, highly detailed, cinematic lighting, 8k resolution`,
        negative_prompt: "blurry, low quality, distorted, deformed"
      };
      
      const sdResp = await env.AI.run("@cf/stabilityai/stable-diffusion-xl-base-1.0", sdInputs);
      
      if (!sdResp.ok) {
        const errorText = await sdResp.text();
        throw new Error(`Image generation failed: ${errorText}`);
      }
      
      // Get image as array buffer and convert to base64
      const imageBuffer = await sdResp.arrayBuffer();
      const base64Image = btoa(String.fromCharCode(...new Uint8Array(imageBuffer)));
      newImageUri = `data:image/png;base64,${base64Image}`;
    }
    
    // Get current metadata
    const currentMetadata = await nftContract.metadata.get(tokenId);
    
    // Prepare updated metadata
    const updatedMetadata = {
      ...currentMetadata,
      ...updateData,
    };
    
    // If we have a new image, update it
    if (newImageUri) {
      updatedMetadata.image = newImageUri;
    }
    
    // Update the NFT metadata
    const updateTx = await nftContract.metadata.update(tokenId, updatedMetadata);
    
    return new Response(JSON.stringify({ 
      message: 'NFT updated successfully', 
      data: { 
        tokenId, 
        updateTx,
        updatedMetadata 
      } 
    }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error updating NFT:', error);
    return new Response(JSON.stringify({ 
      error: 'Error updating NFT', 
      message: error.message 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
