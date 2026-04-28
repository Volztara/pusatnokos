import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
    try {
        const { refresh_token } = await req.json();
        if (!refresh_token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

        const { data, error } = await supabase.auth.refreshSession({ refresh_token });
        if (error || !data.session) return NextResponse.json({ error: 'Refresh failed' }, { status: 401 });

        return NextResponse.json({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
        });
    } catch {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}