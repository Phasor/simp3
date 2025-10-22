import { NextRequest } from 'next/server';
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const creatorName = searchParams.get('creator') || 'Creator';
    const price = searchParams.get('price') || '$100';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            backgroundImage: 'linear-gradient(to bottom, #ffffff, #f1f5f9)',
            fontSize: 32,
            fontWeight: 600,
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'white',
              borderRadius: 24,
              padding: 60,
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid #e2e8f0',
              maxWidth: 800,
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: '#1e293b',
                marginBottom: 16,
              }}
            >
              Chat with {creatorName}
            </div>
            <div
              style={{
                fontSize: 24,
                color: '#64748b',
                marginBottom: 32,
              }}
            >
              Get exclusive one-on-one access
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 32,
              }}
            >
              <div
                style={{
                  backgroundColor: '#f1f5f9',
                  padding: '16px 24px',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: 16, color: '#64748b' }}>Price</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#059669' }}>
                  {price}
                </div>
              </div>
              <div
                style={{
                  backgroundColor: '#f1f5f9',
                  padding: '16px 24px',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ fontSize: 16, color: '#64748b' }}>Access</div>
                <div style={{ fontSize: 32, fontWeight: 700, color: '#2563eb' }}>
                  30 days
                </div>
              </div>
            </div>
            <div
              style={{
                marginTop: 32,
                fontSize: 18,
                color: '#64748b',
              }}
            >
              simp3.app
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    console.log(`${e.message}`);
    return new Response(`Failed to generate the image`, {
      status: 500,
    });
  }
}
