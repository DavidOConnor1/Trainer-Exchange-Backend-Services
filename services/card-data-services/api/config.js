export const POKEMON_TCG_API_BASE_URL = process.env.Pokemon_URL

export const HEADERS = {
    "Content-Type": "application/json",
    "X-Api-Key": process.env.PokemonShow
};

//debug loggers
if (!POKEMON_TCG_API_BASE_URL) {
    console.error('ERROR: Pokemon_URL is not set in .env file');
    process.exit(1);
}

if (!HEADERS['X-Api-Key']) {
    console.error('❌ ERROR: PokemonShow API key is not set in .env file');
}