/**
 * Type definitions for environment variables
 * This file provides TypeScript IntelliSense for process.env variables
 */

declare namespace NodeJS {
  interface ProcessEnv {
    // Ollama Configuration
    OLLAMA_HOST?: string;
    OLLAMA_ENABLED?: string;
    OLLAMA_DEFAULT_MODEL?: string;
    OLLAMA_TIMEOUT_MS?: string;

    // WHOOP API
    WHOOP_CLIENT_ID?: string;
    WHOOP_CLIENT_SECRET?: string;
    WHOOP_REDIRECT_URI?: string;

    // Limitless Pendant
    LIMITLESS_API_KEY?: string;

    // OpenRouter API
    OPENROUTER_API_KEY?: string;

    // OpenAI API
    OPENAI_API_KEY?: string;

    // Database
    DATABASE_ENCRYPTION_KEY?: string;

    // Zep Cloud Memory
    ZEP_API_KEY?: string;

    // Agentic Grok
    AGENTIC_GROK_URL?: string;
    XAI_API_KEY?: string;
    NEXT_PUBLIC_AGENTIC_GROK_URL?: string;
    AGENTIC_MODEL?: string;

    // Secondary Model
    SECONDARY_MODEL?: string;

    // Motion
    MOTION_API_KEY?: string;
    MOTION_API_BASE?: string;
    MOTION_WORKSPACE_ID?: string;
    MOTION_WORKSPACE_MAP?: string;

    // Gmail OAuth
    GMAIL_CLIENT_SECRET_PATH?: string;

    // Analysis Model
    ANALYSIS_MODEL?: string;

    // SMTP
    SMTP_HOST?: string;
    SMTP_PORT?: string;
    SMTP_USER?: string;
    SMTP_PASS?: string;
    SMTP_FROM?: string;
    SMTP_ALLOW_DOMAIN?: string;
    SMTP_PROFILES?: string;
    SMTP_DEFAULT_PROFILE?: string;

    // Twilio
    TWILIO_ACCOUNT_SID?: string;
    TWILIO_AUTH_TOKEN?: string;
    TWILIO_FROM?: string;

    // Streamlit
    NEXT_PUBLIC_STREAMLIT_URL?: string;

    // Clerk Auth
    CLERK_PUBLISHABLE_KEY?: string;
    CLERK_SECRET_KEY?: string;

    // Hyro Forge
    USE_AI_EVALUATION?: string;

    // Base URLs
    LEGAL_API_BASE?: string;
    NEXT_API_BASE_URL?: string;

    // Legal Advocate
    LEGAL_AI_DB_PATH?: string;

    // iMessage
    IMSG_JSON?: string;
  }
}

export {};
