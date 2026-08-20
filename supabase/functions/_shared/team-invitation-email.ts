export type TeamInvitationRole = "staff" | "admin" | "superadmin";

const roleDetails: Record<
  TeamInvitationRole,
  { label: string; access: string }
> = {
  staff: {
    label: "Staff",
    access: "Catalog, inventory, orders, reviews, and customer support.",
  },
  admin: {
    label: "Administrator",
    access: "Operations, customers, payments, reports, and activity logs.",
  },
  superadmin: {
    label: "Super Administrator",
    access: "Full administrative access, including team permissions and store settings.",
  },
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) =>
    ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    })[character]!,
  );

export const buildTeamInvitationEmail = ({
  actionLink,
  role,
  supportEmail,
}: {
  actionLink: string;
  role: TeamInvitationRole;
  supportEmail: string;
}) => {
  const details = roleDetails[role];
  const safeActionLink = escapeHtml(actionLink);
  const safeSupportEmail = escapeHtml(supportEmail);

  return {
    subject: `Invitation to join CozyCraft Furnitures as ${details.label}`,
    text: [
      "COZYCRAFT FURNITURES — TEAM ACCESS",
      "",
      `You have been invited to join CozyCraft Furnitures as ${details.label}.`,
      details.access,
      "",
      "Accept the secure invitation and create your administrator password:",
      actionLink,
      "",
      "For your security, use this link only if you expected an invitation from CozyCraft Furnitures. If you were not expecting it, you can safely ignore this email.",
      "",
      `Questions? Reply to this email or contact ${supportEmail}.`,
      "",
      "This is a transactional account invitation, not a marketing message.",
    ].join("\n"),
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>CozyCraft Furnitures team invitation</title>
  </head>
  <body style="margin:0;background:#f3efe8;color:#211f1c;font-family:Arial,Helvetica,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent">Secure invitation to join the CozyCraft Furnitures operations team.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3efe8;padding:32px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border:1px solid #ddd5ca;border-radius:18px;overflow:hidden">
            <tr>
              <td style="background:#24221f;color:#ffffff;padding:24px 30px">
                <div style="font-size:17px;font-weight:700;letter-spacing:.08em">COZYCRAFT FURNITURES</div>
                <div style="margin-top:6px;font-size:11px;letter-spacing:.18em;color:#d8cec0">TEAM ACCESS</div>
              </td>
            </tr>
            <tr>
              <td style="padding:34px 30px 30px">
                <div style="font-size:11px;font-weight:700;letter-spacing:.16em;color:#756e65">SECURE INVITATION</div>
                <h1 style="margin:12px 0 14px;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.15;font-weight:500">Join the CozyCraft team.</h1>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#57524c">You have been invited to join CozyCraft Furnitures as <strong style="color:#211f1c">${escapeHtml(details.label)}</strong>.</p>
                <div style="margin:0 0 24px;padding:16px 18px;border:1px solid #e4ddd3;border-radius:12px;background:#f8f5f0">
                  <div style="font-size:12px;font-weight:700;color:#211f1c">Your assigned access</div>
                  <div style="margin-top:5px;font-size:14px;line-height:1.55;color:#645e57">${escapeHtml(details.access)}</div>
                </div>
                <table role="presentation" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="border-radius:10px;background:#211f1c">
                      <a href="${safeActionLink}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700">Accept secure invitation</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.65;color:#6d665e">For your security, use this link only if you expected an invitation from CozyCraft Furnitures. If you were not expecting it, you can safely ignore this email.</p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e4ddd3;background:#f8f5f0;padding:20px 30px;font-size:12px;line-height:1.6;color:#746d65">
                Questions? Reply to this email or contact <a href="mailto:${safeSupportEmail}" style="color:#3e3a35">${safeSupportEmail}</a>.<br>
                This is a transactional account invitation, not a marketing message.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
};
