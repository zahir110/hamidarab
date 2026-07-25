# Kebabest launch checklist

## Current ordering flow
- The customer selects menu items and enters name, mobile number, address and notes.
- The server recalculates the total from the current menu and records the order.
- WhatsApp opens with the complete order message. The customer reviews it and taps Send.
- The owner dashboard refreshes new orders automatically and supports acceptance, preparation, dispatch, completion, rejection and Trash.

## Server requirements
- Run the project on a VPS or another Node.js host with persistent writable storage.
- Set `ADMIN_PASSWORD`, `ADMIN_PIN` and a long random `ADMIN_SESSION_SECRET`.
- Set `KEBABEST_DATA_DIR` to a persistent directory owned by the application user.
- Use HTTPS. The owner session cookie is secure in production.
- Back up the data directory daily.

## Before opening to customers
- Confirm the WhatsApp number includes the country code.
- Replace any temporary menu photos, prices, descriptions and opening hours.
- Test one order from a different phone and confirm it appears in both WhatsApp and the owner dashboard.
- Configure the reverse proxy, domain, SSL certificate, process manager and automatic restart.
