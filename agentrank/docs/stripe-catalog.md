# Stripe catalog

Every purchasable placement exists as a **Product + one-time Price + Payment
Link** in the connected Stripe account (all objects carry
`metadata.app = "agentrank"`). The app's checkout uses the Price IDs via
Stripe Checkout Sessions (see `src/lib/pricing.ts`, the single source of
truth); the Payment Links below are a manual sales channel — each link asks
the buyer for their listing name/website so you can apply the placement by
hand from the admin dashboard.

## Permanent Top 5

| Package | Fixed price | Payment link |
|---|---|---|
| Permanent Rank #1 | $4,500 | https://buy.stripe.com/7sY00leAl2823ui3Nb7ok05 |
| Permanent Rank #2 | $3,000 | https://buy.stripe.com/6oUcN7gItbIC8OCfvT7ok06 |
| Permanent Rank #3 | $2,200 | https://buy.stripe.com/bJe00l3VHbIC5Cq4Rf7ok07 |
| Permanent Rank #4 | $1,600 | https://buy.stripe.com/fZucN7gIt9Au4ymfvT7ok08 |
| Permanent Rank #5 | $1,200 | https://buy.stripe.com/28E6oJ9g1282fd00AZ7ok09 |

## Top 10 tier

| Duration | Fixed price | Payment link |
|---|---|---|
| 6 hours | $149 | https://buy.stripe.com/00w9AV63PcMGe8WfvT7ok0a |
| 12 hours | $249 | https://buy.stripe.com/eVq7sNcsd4gac0OfvT7ok0b |
| 24 hours | $399 | https://buy.stripe.com/aFa5kF8bXcMG8OC1F37ok0c |
| 3 days | $899 | https://buy.stripe.com/28E4gB8bX3c68OCbfD7ok0d |
| 7 days | $1,799 | https://buy.stripe.com/6oU7sN8bXbIC3ui6Zn7ok0e |

## Top 20 tier

| Duration | Fixed price | Payment link |
|---|---|---|
| 6 hours | $89 | https://buy.stripe.com/cNi9AV0JvfYS8OC3Nb7ok0f |
| 12 hours | $149 | https://buy.stripe.com/bJefZj77T6oie8W5Vj7ok0g |
| 24 hours | $249 | https://buy.stripe.com/5kQ7sN1Nz282fd04Rf7ok0h |
| 3 days | $549 | https://buy.stripe.com/28EcN7csd6oic0O1F37ok0i |
| 7 days | $1,099 | https://buy.stripe.com/3cI14peAleUOd4ScjH7ok0j |

## Top 50 tier

| Duration | Fixed price | Payment link |
|---|---|---|
| 1 hour | $29 | https://buy.stripe.com/dRmaEZcsddQK4ym4Rf7ok0k |
| 6 hours | $69 | https://buy.stripe.com/7sY28tak5cMG6Guabz7ok0l |
| 12 hours | $109 | https://buy.stripe.com/cNifZjbo9dQKe8W2J77ok0m |
| 24 hours | $179 | https://buy.stripe.com/28EaEZ4ZL6oic0O83r7ok0n |
| 3 days | $399 | https://buy.stripe.com/9B69AV8bX7smgh4gzX7ok0o |

## Extras

| Package | Fixed price | Payment link |
|---|---|---|
| Highlight / Pin · 24 hours | $79 | https://buy.stripe.com/28E9AVfEp9Au5CqbfD7ok0p |
| Highlight / Pin · 7 days | $299 | https://buy.stripe.com/28E5kF2RDeUOfd06Zn7ok0q |
| Featured in Open Section · 24 hours | $25 | https://buy.stripe.com/6oU5kFfEpcMGe8W0AZ7ok0r |

## Changing prices

Stripe prices are immutable. To change a price:

1. Create a new Price on the product in Stripe (or a whole new product).
2. Update the matching entry in `src/lib/pricing.ts` (`amountCents` +
   `stripe.priceId`).
3. Optionally deactivate the old payment link and create a new one.

The app always charges from `src/lib/pricing.ts` via Checkout Sessions, so
step 2 is what actually changes the public price.
