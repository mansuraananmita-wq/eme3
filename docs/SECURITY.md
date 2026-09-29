# Security

Row Level Security is on for every public table. The Data API uses the anon key. `anon` and `authenticated` are the only client roles. Admin, vendor, and customer are the same database role, `authenticated`, with different `profiles.role` values. Column grants apply to all of them. A column omitted from `INSERT` or `UPDATE` cannot be written through the API, including by an admin. Those writes go through `approve_vendor`, `suspend_vendor`, and `set_user_role`, or through a trigger that runs as the table owner.

`public_profiles` exposes `id`, `full_name`, and `avatar_url` to anyone. Phone stays on `profiles`. Email stays in `auth.users`.

## Role matrix

| Table | Anonymous | Customer | Approved vendor | Admin |
| --- | --- | --- | --- | --- |
| profiles | no | read and update own name, phone, avatar | same as customer | read all; update name, phone, avatar; role only via `set_user_role` |
| public_profiles | read | read | read | read |
| vendor_profiles | read approved shops | read approved shops; insert one pending application for self; update own text and images | same, and can still update own shop | read all; delete; status only via `approve_vendor` / `suspend_vendor` |
| categories | read active | read active | read active | read all; insert, update, delete |
| products | read active products of approved shops | same | insert, update, delete own; cannot change `vendor_id` | read all, including drafts; write catalog fields |
| product_images | read images of public products | same | insert, update, delete images of own products | full access |
| product_reviews | read | insert after a delivered order; update and delete own | same as customer; cannot review own product | read; delete |
| platform_settings | read | read | read | insert, update, delete. No secrets in this table |
| addresses, cart_items, wishlist_items, vendor_follows | no | full access to own rows | own rows only | own rows only |
| orders | no | read own | read orders that contain their items | read all. Nobody inserts from the API |
| order_items | no | read lines of own orders | read own lines; update `item_status` only | read all |
| payments | no | read payments of own orders | no | read all. Nobody inserts from the API |
| disputes | no | open and read disputes on own orders | read disputes that involve their items | read all; set status and resolution |
| payouts | no | no | read own | read all; insert, update, delete |
| reels | read published reels of approved shops | same | full CRUD on own, except a `removed` reel | read all; may set `removed` |
| reel_products | read tags on public reels | same | tag only own products on own reels | read all; delete |
| reel_likes, reel_saves | no | read, add, and remove own | same | same, own rows only |
| reel_comments | read comments on public reels | insert and delete own on public reels | same, and delete any comment on own reels | delete any |
| live_streams | read scheduled, live, and ended rooms of approved shops | same | full CRUD on own, except `removed`; pin only a product already on that room | read all; may set `removed` |
| live_stream_products | read items on public rooms | same | add and remove own products on own rooms | read all; delete |
| live_messages | no | read live and ended rooms; send only while the room is live | same, and delete messages on own rooms | read; delete |
| conversations | no | start and read own threads | read threads for their shop | read all |
| messages | no | send as self; the other person sets `read_at` | same | read all |
| user_events | insert with `user_id` null | insert with `user_id` equal to self | same as customer | read all |

Counters, `avg_rating`, `sales_count`, `peak_viewers`, order totals, order status, payment rows, price snapshots, and `created_at` / `updated_at` are not in any client write grant. Triggers maintain the counters. A later checkout function writes orders. The payment webhook writes payments with the service role Supabase already has.

Suspending a shop does not archive its products or reels. Public policies hide them while `vendor_profiles.status` is not `approved`. Approving the shop shows them again.

## Storage paths

Every object lives at `{user_id}/{filename}`. The first folder must equal the signed-in user's id.

| Bucket | Public URL | Limit | Who can write |
| --- | --- | --- | --- |
| product-images | yes | images, 5 MB | approved vendor, own folder |
| reel-videos | yes | mp4, webm, quicktime, 50 MB | approved vendor, own folder |
| reel-thumbnails | yes | images, 2 MB | approved vendor, own folder |
| shop-media | yes | images, 5 MB | approved vendor, own folder |
| live-thumbnails | yes | images, 2 MB | approved vendor, own folder |
| avatars | yes | images, 2 MB | any signed-in user, own folder |

An admin can delete any object in these buckets. These buckets are public, so anyone with the URL can fetch the file. Do not store private documents in them.
