import { ThirdwebSDK } from '@thirdweb-dev/sdk';
import type { CfProperties, Request } from '@cloudflare/workers-types';

interface Env {
  THIRDWEB_NETWORK: string;
  NFT_CONTRACT_ADDRESS: string;
  THIRDWEB_SECRET_KEY: string; // Added for authentication
  STABLE_DIFFUSION_API_KEY: string;
  AI: {
    run: (model: string, inputs: Record<string, any>) => Promise<Response>;
  };
}

interface NFTMetadata {
  name: string;
  description: string;
  image?: string;
  properties?: Record<string, any>;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Add CORS headers for browser requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle OPTIONS request for CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const { pathname } = url;
      
      let response: Response;
      
      if (pathname.startsWith('/nft/mint')) {
        response = await handleMint(request, env);
      } else if (pathname.startsWith('/nft/update')) {
        response = await handleUpdate(request, env);
      } else if (pathname.startsWith('/auth/farcaster')) {
        response = await handleFarcasterAuth(request);
      } else {
        response = new Response('Not Found', { status: 404 });
      }
      
      // Add CORS headers to the response
      Object.entries(corsHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      return response;
    } catch (error) {
      console.error('Error handling request:', error);
      return new Response(JSON.stringify({ error: 'Internal Server Error', message: error.message }), { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};

async function handleMint(request: Request, env: Env): Promise<Response> {
  try {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const body = await request.json();
    const { path, userAddress } = body;
    
    if (!path || !userAddress) {
      return new Response(JSON.stringify({ error: 'Missing parameters' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (!['A', 'B', 'C'].includes(path)) {
      return new Response(JSON.stringify({ error: 'Invalid path' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate image with Stable Diffusion
    console.log('Generating image for path:', path);
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
    const dataUri = `data:image/png;base64,${base64Image}`;
    
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
    
    // Prepare metadata
    const
