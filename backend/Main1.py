
import LazyCook5_Foundational1_grok_gemini2
import asyncio

# Create configured assistant with custom limits
config = LazyCook5_Foundational1_grok_gemini2.create_assistant(
    gemini_api_key="",
    grok_api_key="",
    conversation_limit=1,
    document_limit=0
)
asyncio.run(config.run_cli())

# Run CLI


import LazyCook5_Foundational1_grok_gemini
import asyncio
import os
from LazyCook5_Foundational1_grok_gemini import RichMultiAgentCLI  # or MultiAgentAssistantConfig

config = LazyCook5_Foundational1_grok_gemini.create_assistant(
    gemini_api_key="",
    grok_api_key="",
    conversation_limit=1,
    document_limit=3
)
# Run CLI
asyncio.run(config.run_cli())

# Or create assistant instance directly
assistant=config.create_assistant()

from LazyCook5_Foundational1_grok_gemini2 import MultiAgentAssistantConfig
import os

api_key = os.getenv("")
config = MultiAgentAssistantConfig(api_key, conversation_limit=70)
asyncio.run(config.run_cli())

import asyncio
import os
from LazyCook5_Foundational1_grok_gemini2 import MultiAgentAssistantConfig

# Set API keys directly (no .env needed)
os.environ["GEMINI_API_KEY"] = ""
os.environ["SERPAPI_KEY"] = ""

# Create and run
async def main():
    config = MultiAgentAssistantConfig(
        api_key=os.environ["GEMINI_API_KEY"],
        conversation_limit=70
    )
    await config.run_cli()

if __name__ == "__main__":
    asyncio.run(main())


import LazyCook5_Foundational1
import asyncio
import os
from LazyCook5_Foundational1 import RichMultiAgentCLI  # or MultiAgentAssistantConfig

config=LazyCook5_Foundational1.create_assistant(api_key="",conversation_limit=70)
# Run CLI
asyncio.run(config.run_cli())


# Or create assistant instance directly
assistant=config.create_assistant()
