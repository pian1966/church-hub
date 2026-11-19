# Opening payments: PayFast and the payment doorway

Church & Trellis takes subscriptions and gifts through **PayFast** (chosen by the owner, 19 Nov 2026). Churches pay by card,
Instant EFT or SnapScan; the money goes into Church & Trellis's own bank account, which you give to PayFast – never to the
app, the website or the repository.

Between the app and PayFast sits a tiny **payment doorway** at `churchandtrellis.com/pay` (`tools/payfast-door.mjs`, a
Cloudflare Worker). It holds PayFast's merchant details in Cloudflare's secret settings, signs each payment, and changes a
church's own money (dollars, rupees, shillings…) into rand, because PayFast takes rand only.

Until the last step is done, the Pay button says "Payments open soon". Nothing else changes, and nothing is ever locked.

**Do this on a computer.** It takes about 45 minutes, plus a few days for PayFast to check your documents.

## 1. Open a PayFast account
1. Go to **https://payfast.io** and click **Sign up** (or **Get started**).
2. Choose an **individual** or **business** account, as your accountant advises (see `docs/architecture/BILLING-DECISIONS.md`).
3. Follow PayFast's steps: your details, your ID, and **the bank account the money should go to** (the Church & Trellis
   account). PayFast checks these; it usually takes a few working days.
4. When PayFast says the account is ready, log in and open **Settings → Developer settings** (on some screens: **Integration**).
5. Note your **Merchant ID** and **Merchant Key** somewhere private (not in an email, not in a chat).
6. On the same page, set a **Salt Passphrase**: a long phrase only you know (e.g. four random words). Click **Save**.
   Write it down privately too.

## 2. Make the payment doorway on Cloudflare
1. Go to **https://dash.cloudflare.com** and log in (the account where you bought churchandtrellis.com).
2. In the menu on the left, click **Compute (Workers)** → **Workers & Pages** (older screens: just **Workers & Pages**).
3. Click **Create** → **Create Worker** (or **Start with Hello World!**). Name it `pay`. Click **Deploy**.
4. Click **Edit code**. Select everything in the code box and delete it.
5. Open **https://github.com/pian1966/church-hub/blob/main/tools/payfast-door.mjs**, click the **Copy raw file** button
   (two overlapping squares, top right of the file), and paste it into Cloudflare's code box.
6. Click **Deploy** (top right).

## 3. Give the doorway its secret settings
1. Still in the `pay` Worker, click **Settings** → **Variables and Secrets** → **Add**.
2. Add these four, one at a time. For each, choose **Type: Secret**, type the **Variable name** exactly as shown, paste the
   value, and click **Deploy** (or **Save**):

| Variable name | Value |
|---|---|
| `MERCHANT_ID` | your PayFast Merchant ID |
| `MERCHANT_KEY` | your PayFast Merchant Key |
| `PASSPHRASE` | the Salt Passphrase you set at PayFast |
| `SANDBOX` | `yes` for now (a practice run, no real money – step 5 changes it) |

For the practice run, use PayFast's **sandbox** details instead of your real ones: go to **https://sandbox.payfast.co.za**,
log in with your PayFast email, and copy the sandbox Merchant ID, Merchant Key and passphrase from its Settings page.

## 4. Put the doorway at churchandtrellis.com/pay
1. In the `pay` Worker, click **Settings** → **Domains & Routes** → **Add** → **Route**.
2. **Zone:** `churchandtrellis.com`. **Route:** `churchandtrellis.com/pay*`. Click **Add route**.
3. Check: in the left menu open **Websites** → **churchandtrellis.com** → **DNS**. The cloud next to churchandtrellis.com
   must be **orange** ("Proxied"). If it's grey, click **Edit**, switch it to Proxied, **Save**.
4. Test: open **https://churchandtrellis.com/pay?amount=50&currency=ZAR&kind=month&ref=CH-TEST01** – you should see
   "Thank you! Taking you to PayFast to pay R50", then PayFast's sandbox page. Pay with the sandbox's test card.

## 5. Go live
1. In the Worker's **Variables and Secrets**, change `MERCHANT_ID`, `MERCHANT_KEY` and `PASSPHRASE` to your **real**
   PayFast details, and **delete** `SANDBOX` (or set it to `no`). Click **Deploy**.
2. Tell Claude: **"PayFast is live at churchandtrellis.com/pay"**. Claude then switches on the Pay button in the app
   (`PAY_URL` in `js/coffee.js`) and the Give button on the website – one small change each.

## Good to know
- **No debit orders.** Each payment is one at a time: a church presses Pay when its coffee is due (Home reminds its
  Administrator a few days before). So a payment holiday never needs cancelling anywhere – the church simply skips that month.
- **What PayFast sees:** the amount, the church's short reference (e.g. `CH-7K2P9Q`, the same every time), and whether it
  is a month, a year, a gift or for another church. Never anyone's name, and never anything about the church's people.
- **Matching payments to churches:** PayFast's transaction list shows each payment's reference in **Custom string 1**.
- **Exchange rates** come from a free public list (fawazahmed0's currency-api), looked up when someone pays and kept for half a day.
- **PayFast's smallest payment is R5.** A church whose monthly coffee is less (chai in India is about R3) is shown that and
  invited to pay for the year instead.
- **If a secret ever leaks**, change it at PayFast (and in the Worker) – nothing in the app or repository needs to change.
