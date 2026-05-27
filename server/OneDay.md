# Product Analysis Document: Personal Item Lifecycle Tracker App

## 1. Project Positioning
This product is essentially **NOT**:
* A bank accounting app
* A stock/asset app
* A financial management app

Instead, it is a **Personal Item Lifecycle Tracker**.
* **Core Logic:** Record everything that happens *after* "owning" an item. Users record not only how much money was spent, but also the concept of the item's price during its usage.

## 2. Core Product Philosophy
* **Traditional accounting:** Payment completed = Record ends.
* **This product:** Payment completed = Lifecycle begins. It automatically calculates daily costs and records item categories. This is the biggest difference from standard accounting software.

## 3. Core Direction
The core is **NOT** asset appreciation. Instead, it is the **True Cost of Usage**.
For example, what users truly care about:
* **MacBook:** Actual cost per day
* **AirPods:** Cost per use
* **Camera:** Cost per shot
* **Perfume:** Cost per spray
* **Car:** Cost per kilometer and maintenance cost
* **Cosmetics:** Actual usage frequency

## 4. True Product Highlights (Core)
1. **Real Image Recording:** Users upload photos of real possessions (phones, cameras, bags, jewelry, cosmetics, computers, cars)—not abstract assets.
2. **Irregular Images / Masonry Layout:** Differentiating from the square thumbnails of traditional asset apps, it recommends a Pinterest style. It supports long images, irregular aspect ratios, multiple images, and free-form image walls. The product feels more like a lifestyle app than a financial tool.
3. **Daily Cost (Core Feature):** Example: MacBook Pro (14,999 RMB) used for 500 days ≈ 30 RMB / day. Users will start to rethink their consumption.
4. **Cost Per Use (Core Highlight):** Example: Sony Camera (20,000 RMB) taking 4000 shots ≈ 5 RMB / shot. Or AirPods (1,999 RMB) used 1200 times ≈ 1.6 RMB / use. This is a highly memorable feature.

## 5. What the Product Truly Records
Users are not recording "bills", but rather: **The relationship between humans and items.**

## 6. Core Data Model (Crucial)
The true core is **NOT** `Asset`. It is **`Item`**.

## 7. Truly Important Data Structures
* **Item:** Records Name, Image, Category, Acquisition date, Purchase price, Current status, Tags, and Notes.
* **Event:** This is the most core system of the entire app because all statistics come from events.

## 8. Event System
Each item continuously generates events. For example:
`Item` -> `PurchaseEvent`, `UsageEvent`, `MaintenanceEvent`, `RepairEvent`, `ExpenseEvent`, `SellEvent`.

## 9. Why the Event System is Important
Because all statistics depend on events:
* **Daily cost:** (Purchase price + Repair costs + Maintenance costs + Consumables costs) / Days owned.
* **Cost per use:** Total cost / Number of uses.

## 10. Core Functional Modules (What Should Be Done)
1. **Item Management System:** Supports Add, Edit, Delete, Categorize, Tag, and Search.
2. **Image System (Key focus):** Supports multi-image upload, long images, irregular images, image walls, and masonry layout.
3. **Usage Record System (Core):** User clicks "Used it today" to generate a Usage Event.
4. **Maintenance Record System:** E.g., Car maintenance, MacBook battery replacement, Shoe cleaning.
5. **Repair Record System:** Records Date, Cost, Reason, and Images.
6. **Consumables Record System:** E.g., Photo paper, Ink, Cosmetics refills, Phone screen protectors, Batteries.
7. **Timeline System (Core):** E.g., `2026-01-01 Purchased` -> `2026-01-03 First use` -> `2026-02-10 Screen protector replaced` -> `2026-03-11 Repaired`. This is the most important accumulation feature of the product.

## 11. What Should Truly Be Displayed on the Home Page
**NOT:** Total assets.
**Instead:** A "Lifestyle Item Data Dashboard".
* *Today's most cost-effective:* AirPods Pro (1.2 RMB / use)
* *Most frequently used recently:* MacBook Pro
* *Longest idle:* Sony Camera

## 12. The True User Psychology
This product will make users start reflecting on their consumption behavior. E.g., "I only used this bag 3 times this year", or "This computer actually only cost me 20 RMB a day."

## 13. True Product Essence
This product is essentially a **Consumption Amortization System** and a **Daily Life Digitization System**. It is not a traditional financial system.

## 14. Technical Implementation
* **Recommended technical direction:** Since it currently only runs locally, no complex backend is needed.
* **Recommended tech stack:** Vue3 + Vant4 + Pinia + Vite + IndexedDB + ECharts.

## 15. Why Vant4 is Recommended
The product heavily relies on forms, uploads, lists, and mobile-first styling. Vant4 is highly suitable for light lifestyle products.

## 16. Why a Local Database is Necessary
The product generates massive amounts of usage records, images, timelines, and categorized statistics, which cannot rely solely on memory.

## 17. Best Fit for Data Storage
**Recommended: IndexedDB.**
Reasons: Offline support, large capacity, native to the browser, and perfect for local execution.

## 18. The Truly Complex Technical Parts
The complexity lies not in the UI, but in:
1. **Event Aggregation System:** Home page statistics rely entirely on Event data.
2. **Image System:** Handling many images, irregular sizes, complex masonry layouts, and critical image caching.
3. **Timeline System:** All behaviors need to be perfectly event-driven and sequenced.

## 19. The Best Fit UI Style
* **Don't use:** Bank backend style.
* **Should be:** Lifestyle App.
* **Recommended references:** Apple Wallet, Notion, Readwise, Pinterest, Xiaohongshu (RED) favorites.

## 20. What MVP Version 1 Should Truly Build
* **Must do:** 1. Item CRUD, 2. Image upload, 3. Usage records, 4. Daily cost, 5. Cost per use, 6. Timeline, 7. Search, 8. Categories.
* **Don't do yet:** AI, Cloud sync, Login, Auto-valuation, Social, Multi-user collaboration.

## 21. Final Product Core (Very Important)
The true core of this product is **NOT** how many assets you own.
Instead, it is: **Whether you actually use them.** This is the core product value.