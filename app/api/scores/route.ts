import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = "https://yaymdgepebyzqmkdgdqn.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlheW1kZ2VwZWJ5enFta2RnZHFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2Nzg0NDQsImV4cCI6MjA4OTI1NDQ0NH0.KmkrNppMhZp3FMqh3ZluCLE3LTOuET8L7YE6SxNhLQA";

async function getCountryFromIP(ip: string): Promise<string> {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country`);
    if (res.ok) {
      const data = await res.json();
      return data.country || "Unknown";
    }
  } catch {}
  return "Unknown";
}

// GET - fetch leaderboard and loserboard
export async function GET() {
  try {
    // Fetch top 15 winners (fastest times, won=true)
    const winnersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/scores?won=eq.true&order=time_seconds.asc&limit=15&select=name,country,time_seconds,mines_cleared,total_mines,difficulty,oil_price,tankers_blown_up,created_at`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    // Fetch top 15 losers (highest oil price or fastest death)
    const losersRes = await fetch(
      `${SUPABASE_URL}/rest/v1/scores?won=eq.false&order=oil_price.desc,time_seconds.asc&limit=15&select=name,country,time_seconds,mines_cleared,total_mines,difficulty,oil_price,tankers_blown_up,created_at`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );

    const winners = winnersRes.ok ? await winnersRes.json() : [];
    const losers = losersRes.ok ? await losersRes.json() : [];

    return NextResponse.json({ winners, losers });
  } catch (err) {
    return NextResponse.json({ winners: [], losers: [], error: "Failed to fetch scores" }, { status: 500 });
  }
}

// POST - submit a new score
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, time_seconds, mines_cleared, total_mines, difficulty, won, oil_price, tankers_blown_up } = body;

    if (!name || name.length > 20) {
      return NextResponse.json({ error: "Name required (max 20 chars)" }, { status: 400 });
    }

    // Get country from IP
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    const country = await getCountryFromIP(ip);

    // Insert into Supabase
    const res = await fetch(`${SUPABASE_URL}/rest/v1/scores`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        name: name.trim().substring(0, 20),
        country,
        time_seconds: Math.max(0, Math.floor(time_seconds)),
        mines_cleared: Math.max(0, Math.floor(mines_cleared)),
        total_mines: Math.max(0, Math.floor(total_mines)),
        difficulty,
        won: !!won,
        oil_price: Math.max(50, Math.floor(oil_price)),
        tankers_blown_up: Math.max(0, Math.floor(tankers_blown_up || 0)),
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: errText }, { status: 500 });
    }

    const data = await res.json();
    return NextResponse.json({ success: true, score: data[0] });
  } catch (err) {
    return NextResponse.json({ error: "Failed to submit score" }, { status: 500 });
  }
}
