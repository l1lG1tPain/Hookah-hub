export const handler = async () => {
    const mask = v => (v ? 'set' : 'missing');
    return {
        statusCode: 200,
        body: JSON.stringify({
            SUPABASE_URL: mask(process.env.SUPABASE_URL),
            SUPABASE_SERVICE_ROLE: mask(process.env.SUPABASE_SERVICE_ROLE),
            TELEGRAM_BOT_TOKEN: mask(process.env.TELEGRAM_BOT_TOKEN),
            VITE_SUPABASE_URL: mask(process.env.VITE_SUPABASE_URL),
            VITE_SUPABASE_ANON_KEY: mask(process.env.VITE_SUPABASE_ANON_KEY),
        })
    };
};
