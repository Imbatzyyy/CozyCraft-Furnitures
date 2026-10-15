// Exact conversational intents only. Never consume a substantive question just
// because it begins with "hello", or invent changing prices/account facts here.
export function basicCozyCraftReply(message: string): string | null {
  const text = message.normalize("NFKC").toLowerCase().replace(/[’]/g, "'")
    .replace(/[!?.…,]/g, " ").replace(/\s+/g, " ").trim();
  const greeting = "(?:hi|hello|hey|good morning|good afternoon|good evening|kumusta|kamusta)";
  const greetingOnly = new RegExp(`^${greeting}(?: (?:there|po|cozy|cozycraft|cozy craft)){0,2}$`);
  const question = /^(?:kumusta|kamusta) ka/.test(text) ? text
    : text.replace(new RegExp(`^${greeting}(?: (?:there|po|cozy|cozycraft|cozy craft))? `), "");
  const filipino = /\b(po|kumusta|kamusta|ano|sino|mo|ka|salamat)\b/.test(text);
  if (greetingOnly.test(text)) return filipino
    ? "Hello po! Ako si Cozy, ang CozyCraft shopping assistant. Masaya akong tumulong sa furniture at mga tanong tungkol sa CozyCraft. Ano po ang gusto mong malaman?"
    : "Hello! I’m Cozy, your CozyCraft shopping assistant. Happy to help with furniture or any questions about shopping with us. What would you like to know?";
  if (/^(?:how are you|how's it going|kumusta ka|kamusta ka|are you (?:there|online|active)|hello are you active)(?: po)?$/.test(question)) return filipino
    ? "Nandito po ako at handang tumulong sa CozyCraft! May furniture ka bang hinahanap, o may tanong tungkol sa pamimili?"
    : "I’m here and ready to help! Are you looking for furniture, or is there something you’d like to know about CozyCraft?";
  if (/^(?:who are you|what(?:'s| is) your name|are you (?:a bot|an ai|human)|sino ka|ano(?: ang)? pangalan mo)(?: po)?$/.test(question)) return filipino
    ? "Ako si Cozy, ang AI shopping assistant ng CozyCraft. Makakatulong ako sa furniture at shopping questions, pero hindi ako human staff at hindi ako makakapagbayad o makakapagbago ng order para sa iyo."
    : "I’m Cozy, CozyCraft’s AI shopping assistant. I can answer furniture and shopping questions, but I’m not a human staff member and I can’t make payments or change orders for you.";
  if (/^(?:what can you (?:do|help (?:me )?with)|how can you help(?: me)?|can you help(?: me)?|help(?: me)?|ano(?: ang)? (?:kaya mong gawin|maitutulong mo))(?: po)?$/.test(question)) return filipino
    ? "Makakatulong ako sa pagpili ng furniture, prices at availability, delivery, payments, returns, vouchers, at account concerns. Sabihin lang ang tanong mo; hindi kailangang alam mo na ang page na pupuntahan."
    : "I can help with furniture choices, prices and availability, delivery, payments, returns, vouchers, and account questions. Just ask in your own words. What would you like to know?";
  if (/^(?:(?:what is|what's|tell me about|what do you know about|ano(?: ang)?) cozy ?craft(?: furnitures?)?|what is this app|what(?:'s| is) this app (?:for|about)|how does (?:cozy ?craft|this app) work)(?: po)?$/.test(question)) return filipino
    ? "Ang CozyCraft ay furniture shopping app at website para sa living room, bedroom, at dining room. Maaari kang tumingin ng products, mag-save ng favorites, mag-order, at subaybayan ang iyong orders. Anong klaseng furniture ang hinahanap mo?"
    : "CozyCraft is a furniture shopping app and website for living rooms, bedrooms, and dining rooms. You can explore products, save favorites, place orders, and follow your orders in one place. What kind of furniture are you looking for?";
  if (/^(?:what(?:'s| is) (?:a |the )?(?:wishlist|wish list)|what are saved (?:pieces|items)|what is (?:a |the )?wishlist for)$/.test(question)) return "A wishlist, called Saved Pieces in the app, keeps furniture you like for later. Saving an item doesn’t place an order or reserve stock. Your bag is where you collect the items you’re considering for checkout.";
  if (/^(?:what(?:'s| is) (?:a |the )?(?:shopping )?(?:bag|cart)|what is (?:a |the )?(?:bag|cart) for)$/.test(question)) return "Your bag holds the products and quantities you’re considering buying. Adding an item doesn’t charge you or reserve stock. You review selected items, delivery details, and the final total before placing an order.";
  if (/^(?:thanks|thank you|thank you so much|thanks a lot|salamat|maraming salamat)(?: po)?$/.test(text)) return filipino
    ? "Walang anuman po! Nandito ako kung may iba ka pang tanong tungkol sa CozyCraft."
    : "You’re welcome! I’m here whenever you have another CozyCraft question.";
  if (/^(?:bye|goodbye|see you|paalam)(?: po)?$/.test(text)) return filipino
    ? "Paalam po! Nandito lang ako kapag kailangan mo ng tulong sa CozyCraft."
    : "Goodbye for now! I’ll be here when you need a hand with CozyCraft.";
  return null;
}
