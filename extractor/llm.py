"""One function, call_llm(text) -> dict, behind which the provider is swappable.

Default provider is DeepSeek (OpenAI-compatible, JSON Output via
response_format={"type": "json_object"}). Set LLM_PROVIDER=claude to use Anthropic's
structured outputs instead. Keep both paths returning the same Packet-shaped dict."""
import json
import os

from dotenv import load_dotenv

from schema import Packet, EXAMPLE_JSON

load_dotenv()

PROVIDER = os.getenv("LLM_PROVIDER", "deepseek").lower()

PROMPT = f"""You extract fields from a new-account brokerage packet (application, ID, and
optional transfer statement). Return ONLY a json object matching this exact shape, with
every scalar field as an object {{"value": ..., "confidence": 0..1}}. If a field is not
found on the page, set its value to null and confidence to 0. Confidence is your own
estimate of how sure you are of the value. Dates must be YYYY-MM-DD. Do not invent data.

If a transfer statement is present, set transfer to an object with the same
{{"value","confidence"}} scalar fields: holder_name (the "Account holder name" line),
source_account_type, and account_number. Use null for transfer only when no transfer
statement is in the packet.

Example of the required json shape:
{EXAMPLE_JSON}

Here is the packet text to extract:
"""


def _validate(raw: str) -> dict:
    """Validate against the Pydantic schema; fall back to raw JSON if validation fails."""
    try:
        return Packet.model_validate_json(raw).model_dump()
    except Exception:
        return json.loads(raw)


def _call_deepseek(text: str) -> dict:
    from openai import OpenAI

    client = OpenAI(
        base_url=os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com"),
        api_key=os.environ["DEEPSEEK_API_KEY"],
    )
    resp = client.chat.completions.create(
        model=os.getenv("DEEPSEEK_MODEL", "deepseek-chat"),
        response_format={"type": "json_object"},
        temperature=0,
        messages=[{"role": "user", "content": PROMPT + text}],
    )
    return _validate(resp.choices[0].message.content)


def _call_claude(text: str) -> dict:
    from anthropic import Anthropic

    client = Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    resp = client.messages.parse(
        model=os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5"),
        max_tokens=2048,
        messages=[{"role": "user", "content": PROMPT + text}],
        output_format=Packet,
    )
    return resp.parsed_output.model_dump()


def call_llm(text: str) -> dict:
    if PROVIDER == "claude":
        return _call_claude(text)
    return _call_deepseek(text)
