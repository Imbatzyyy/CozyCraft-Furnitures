type Snapshot = {
  recipient: string; recipientName: string; subject: string; heading: string; body: string;
  variables: Record<string,string>; storeName: string; replyTo?: string;
};
const escape = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
const render = (template: string, vars: Record<string,string>) => String(template ?? "").replace(/\{\{([a-z_]+)\}\}/g, (_, key)=>String(vars[key] ?? ""));
export function buildTransactionalEmail(job: Snapshot) {
  const subject=render(job.subject,job.variables).replace(/[\r\n]/g," ").slice(0,180);
  const heading=escape(render(job.heading,job.variables));
  const message=escape(render(job.body,job.variables));
  const store=escape(job.storeName);
  return {
    subject,
    text:`Hello ${job.recipientName},\n\n${render(job.body,job.variables)}\n\nView your account: https://www.cozycraftfurnitures.com/profile`,
    html:`<div style="background:#f4f0e8;padding:24px 12px;font-family:Arial,sans-serif;color:#24211e"><div style="max-width:620px;margin:auto;background:white;border-radius:20px;overflow:hidden"><div style="padding:24px;text-align:center;border-bottom:1px solid #e5ded3"><img src="https://www.cozycraftfurnitures.com/email-logo.png" alt="${store}" width="150" style="max-width:150px;height:auto"><p style="font-size:11px;letter-spacing:2px">CUSTOMER CARE</p></div><div style="padding:28px"><h1 style="font-family:Georgia,serif;font-size:30px;line-height:1.2">${heading}</h1><p>Hello ${escape(job.recipientName)},</p><p style="line-height:1.7;white-space:pre-line">${message}</p><p style="margin-top:28px"><a href="https://www.cozycraftfurnitures.com/profile" style="display:inline-block;background:#201e1b;color:white;text-decoration:none;border-radius:12px;padding:14px 20px;font-weight:bold">View your account</a></p></div><div style="padding:20px 28px;background:#eee8de;font-size:12px;line-height:1.6">Sent because of activity on your ${store} account.</div></div></div>`,
  };
}
