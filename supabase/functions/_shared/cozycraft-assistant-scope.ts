export type AssistantScopeMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantScopeDecision = {
  allowed: boolean;
  reason: "cozycraft" | "conversation" | "off_topic" | "security_probe" | "safety";
};

const normalized = (value: string) =>
  value.toLocaleLowerCase("en-PH").normalize("NFKC").replace(/\s+/g, " ").trim();

const securityProbe = /\b(ignore (?:all |the )?(?:previous|prior|system|developer) instructions?|system prompt|developer message|hidden prompt|jailbreak|prompt injection|act as|pretend (?:you are|to be)|dan mode|unrestricted mode|reveal (?:your|the) (?:prompt|instructions?)|api keys?|secret keys?|database credentials?|service role key)\b/i;
const safetyConcern = /\b(kill myself|suicide|self[- ]?harm|hurt myself|want to die|end my life|kill (?:him|her|them|someone)|bomb threat)\b/i;
const clearlyUnrelated = /\b(python|javascript|typescript|java programming|c\+\+|c#|ruby code|php code|sql (?:query|code|script)|write (?:me )?(?:a )?code|debug (?:my|this) code|coding project|programming|build (?:me )?(?:a )?(?:website|app|program|script)|create (?:me )?(?:a )?(?:website|app|program|script)|homework|assignment|write (?:me )?(?:an )?essay|solve (?:this )?(?:equation|math)|calculus|translate (?:this|the)|recipe|cook(?:ing)? recipe|politics|election|president of|song lyrics?|write (?:me )?(?:a )?song|generate (?:an )?image|movie review|video game|horoscope|crypto trading|stock trading|relationship advice|roleplay)\b/i;

const cozyCraftSignal = /\b(cozycraft|cozy craft|furniture|furnitures|sofas?|couches?|chairs?|tables?|beds?|bedroom|living room|dining room|cabinets?|wardrobes?|dressers?|nightstands?|shelves|desks?|products?|catalog|stock|availability|available|prices?|budget|compare|shop|shopping|buy|purchase|new arrivals?|orders?|packages?|tracking|shipments?|delivery|shipping|fees?|checkout|paymongo|payments?|paid|cards?|gcash|cash on delivery|cod|cart|shopping bag|wishlist|favorites?|favourites?|cancel|cancellation|returns?|refunds?|reviews?|ratings?|photos?|account|profile|sign in|signin|login|password|authenticator|otp|verify|verification|verification code|phone|phone number|email address|delivery address|privacy|terms|faq|contact|customer care|support|tickets?|points?|loyalty|home circle|membership|tier|invoice|receipt|promo|voucher|discount|mobile app|website)\b/i;
const politeConversation = /^(?:hi|hello|hey|good (?:morning|afternoon|evening)|kumusta|kamusta|hello po|hi po|thanks?|thank you|salamat(?: po)?|bye|goodbye|who are you|what can you do|are you (?:active|online|there)|can you help me)[!.?\s]*$/i;

const hasCozyCraftSignal = (message: string) =>
  cozyCraftSignal.test(message);

export function classifyAssistantRequest(
  message: string,
  history: AssistantScopeMessage[] = [],
): AssistantScopeDecision {
  const text = normalized(message);
  if (!text) return { allowed: false, reason: "off_topic" };
  if (safetyConcern.test(text)) return { allowed: false, reason: "safety" };
  if (securityProbe.test(text)) return { allowed: false, reason: "security_probe" };
  if (clearlyUnrelated.test(text)) return { allowed: false, reason: "off_topic" };
  if (politeConversation.test(text) || hasCozyCraftSignal(text)) {
    return { allowed: true, reason: "cozycraft" };
  }

  const latestUserMessage = [...history]
    .reverse()
    .find((item) => item.role === "user")?.content;
  if (
    text.length <= 160 &&
    latestUserMessage &&
    !securityProbe.test(latestUserMessage) &&
    !clearlyUnrelated.test(latestUserMessage) &&
    hasCozyCraftSignal(normalized(latestUserMessage))
  ) {
    return { allowed: true, reason: "conversation" };
  }

  return { allowed: false, reason: "off_topic" };
}

export function customerFacingScopeReply(
  decision: AssistantScopeDecision,
  message: string,
) {
  if (decision.reason === "security_probe") {
    return "I can’t provide hidden instructions, access credentials, API keys, private configuration, or ways to bypass CozyCraft security. I can still help with products, orders, delivery, payments, account access, returns, reviews, or a customer-care concern.";
  }
  if (decision.reason === "safety") {
    return "I’m sorry you’re going through this. CozyCraft Care is not an emergency or crisis service. Please contact your local emergency services now or reach out immediately to a trusted person who can stay with you. When you need help with a CozyCraft order or account, I’ll be here for that too.";
  }

  const tagalog = /\b(po|ako|aking|paano|bakit|pwede|maaari|tulong|salamat)\b/i.test(message);
  return tagalog
    ? "Nandito ako bilang CozyCraft shopping at customer-care assistant, kaya hindi ako makakatulong sa coding o ibang usaping walang kaugnayan sa CozyCraft. Masaya akong tumulong sa furniture, product availability, cart o wishlist, checkout at payment, delivery, orders, returns, reviews, account access, o support concern. Ano pong CozyCraft concern ang maitutulong ko?"
    : "I’m here specifically for CozyCraft shopping and customer care, so I can’t help with coding or unrelated requests. I’d be happy to help with furniture, product availability, your bag or wishlist, checkout and payments, delivery, orders, returns, reviews, account access, or a support concern. What CozyCraft concern can I help with?";
}

export function keepScopedConversation(messages: AssistantScopeMessage[]) {
  const kept: AssistantScopeMessage[] = [];
  let latestUserWasAllowed = false;

  for (const message of messages) {
    if (message.role === "user") {
      latestUserWasAllowed = classifyAssistantRequest(message.content, kept).allowed;
      if (latestUserWasAllowed) kept.push(message);
      continue;
    }
    if (latestUserWasAllowed) kept.push(message);
  }

  return kept;
}
