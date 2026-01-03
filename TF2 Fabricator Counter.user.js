// ==UserScript==
// @name        TF2 Fabricator Counter (Net Totals)
// @namespace   https://github.com/Raytr0
// @version     2.0
// @author      Raytr0
// @description Net Total Calculation: Subtracts items you already have visible in your inventory from the total needed.
// @match       *://steamcommunity.com/id/*/inventory*
// @match       *://steamcommunity.com/profiles/*/inventory*
// @match       *://steamcommunity.com/tradeoffer/*
// @grant       unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    const ATTR_FINISHED = 'data-fab-v8-0';
    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    // --- UI Creation (Summary Box) ---
    const summaryBox = document.createElement('div');
    summaryBox.id = 'fab_total_summary';
    summaryBox.style.position = 'fixed';
    summaryBox.style.top = '60px';
    summaryBox.style.left = '10px';
    summaryBox.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
    summaryBox.style.border = '2px solid #7D6D00';
    summaryBox.style.borderRadius = '4px';
    summaryBox.style.padding = '8px';
    summaryBox.style.zIndex = '99999';
    summaryBox.style.fontFamily = 'Arial, sans-serif';
    summaryBox.style.minWidth = '160px';
    summaryBox.style.pointerEvents = 'none';
    summaryBox.style.display = 'none';
    document.body.appendChild(summaryBox);

    // --- Helpers ---

    function getDisplaySettings(fullName) {
        let clean = fullName;
        let color = '#ffcc00'; // Default Gold

        // 1. Determine Color & Tier Label
        if (clean.includes('Specialized Killstreak')) {
            color = '#32CD32'; // Green
            clean = clean.replace('Specialized Killstreak', 'Spec KS');
        } else if (clean.includes('Killstreak')) {
            if (clean.includes('Professional Killstreak')) {
                color = '#FFD700';
                clean = clean.replace('Professional Killstreak', 'Pro KS');
            } else {
                color = '#b0b0b0'; // Gray
                clean = clean.replace('Killstreak', 'Basic KS');
            }
        }

        // 2. Abbreviate Robot Parts
        clean = clean.replace(/Battle-Worn(?: Robot)?/g, 'BR');
        clean = clean.replace(/Reinforced(?: Robot)?/g, 'RI');
        clean = clean.replace(/Pristine(?: Robot)?/g, 'PR');

        // 3. Clean Fluff
        clean = clean
            .replace('Unique ', '')
            .replace('Item', '')
            .trim();

        // 4. Specific Shortenings
        clean = clean.replace('Money Furnace', 'Furnace');
        clean = clean.replace('Taunt Processor', 'Processor');
        clean = clean.replace('KB-808', 'KB');

        // 5. Truncate
        if (clean.length > 20) clean = clean.substring(0, 18) + '..';

        return { text: clean, color: color };
    }

    function getIngredients(descriptionArray) {
        if (!descriptionArray) return [];
        let ingredients = [];

        for (let lineObj of descriptionArray) {
            let text = lineObj.value ? String(lineObj.value).trim() : "";
            if (!text || text.includes("must be fulfilled") || text === "Inputs:") continue;

            let matchX = text.match(/(.*?) x (\d+)/);
            let matchProgress = text.match(/\((\d+)\/(\d+)\)\s*(.*)/);

            if (matchX) {
                ingredients.push({ name: matchX[1].trim(), count: parseInt(matchX[2]) });
            }
            else if (matchProgress) {
                let current = parseInt(matchProgress[1]);
                let max = parseInt(matchProgress[2]);
                if (current < max) {
                    ingredients.push({ name: matchProgress[3].trim(), count: max - current });
                }
            }
        }
        return ingredients;
    }

    function getItemData(element) {
        if (element.rgItem) return element.rgItem;
        if (element.id && win.g_ActiveInventory && win.g_ActiveInventory.m_rgAssets) {
            const parts = element.id.split('_');
            if (parts.length >= 3) {
                const assetId = parts[2];
                const asset = win.g_ActiveInventory.m_rgAssets[assetId];
                if (asset) {
                    const key = asset.classid + '_' + asset.instanceid;
                    const desc = win.g_ActiveInventory.m_rgDescriptions[key];
                    if (desc) return { ...asset, descriptions: desc.descriptions, market_hash_name: desc.market_hash_name };
                }
            }
        }
        return null;
    }

    // --- Main Logic ---

    function scanItems() {
        const allItems = document.querySelectorAll('.item');

        let globalNeeded = {}; // What the Fabricators require
        let globalOwned = {};  // What "Loose" items we have in inventory
        let fabricatorFound = false;

        allItems.forEach(item => {
            let data = null;

            // Try to use cached data or fetch it
            if (item.fabCachedData) {
                data = item.fabCachedData;
            } else {
                data = getItemData(item);
                if (data) item.fabCachedData = data; // Cache lookup
            }

            if (!data) return;

            const rawName = data.market_hash_name || "";
            const isFabricator = rawName.includes('Fabricator');

            if (isFabricator) {
                fabricatorFound = true;

                // --- PROCESS FABRICATOR REQUIREMENTS ---
                let ingredients = item.fabCachedIngredients;
                if (!ingredients) {
                    ingredients = getIngredients(data.descriptions);
                    item.fabCachedIngredients = ingredients;
                }

                // Add to Global Needed Count
                ingredients.forEach(ing => {
                    if (!globalNeeded[ing.name]) globalNeeded[ing.name] = 0;
                    globalNeeded[ing.name] += ing.count;
                });

                // --- RENDER OVERLAY (If new) ---
                if (!item.getAttribute(ATTR_FINISHED)) {
                    renderOverlay(item, ingredients);
                    item.setAttribute(ATTR_FINISHED, 'true');
                }

            } else {
                // --- PROCESS OWNED ITEMS ---
                // If this is NOT a fabricator, it might be a part we own.
                // We tally it up using the EXACT market hash name.
                // Note: TF2 Inventory usually doesn't stack items in one slot,
                // so each element is usually Count: 1.
                // However, we check `amount` just in case (e.g. currency).

                let count = 1;
                if (data.amount) count = parseInt(data.amount); // Handle stacks if any

                // Use the raw name to match the recipe name
                // Recipe: "Battle-Worn Robot KB-808"
                // Item Name: "Battle-Worn Robot KB-808"
                if (!globalOwned[rawName]) globalOwned[rawName] = 0;
                globalOwned[rawName] += count;
            }
        });

        updateSummaryBox(globalNeeded, globalOwned, fabricatorFound);
    }

    function renderOverlay(item, ingredients) {
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '1px';
        container.style.right = '2px';
        container.style.textAlign = 'right';
        container.style.pointerEvents = 'none';
        container.style.zIndex = '10';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';

        ingredients.forEach(ing => {
            const settings = getDisplaySettings(ing.name);
            const line = document.createElement('div');
            line.innerText = `${ing.count} x ${settings.text}`;
            line.style.color = settings.color;
            line.style.fontSize = '10px';
            line.style.fontWeight = 'bold';
            line.style.fontFamily = 'Arial, sans-serif';
            line.style.textShadow = '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 2px 2px 0px #000';
            line.style.lineHeight = '10px';
            line.style.marginBottom = '1px';
            container.appendChild(line);
        });

        item.appendChild(container);
    }

    function updateSummaryBox(needed, owned, visible) {
        if (!visible || Object.keys(needed).length === 0) {
            summaryBox.style.display = 'none';
            return;
        }

        let htmlRows = '';
        const names = Object.keys(needed).sort();

        names.forEach(name => {
            const neededCount = needed[name];
            const ownedCount = owned[name] || 0; // Check our owned stash

            const netNeeded = neededCount - ownedCount;

            // Only show if we still need more
            if (netNeeded > 0) {
                const settings = getDisplaySettings(name);
                htmlRows += `
                    <div style="display: flex; justify-content: space-between; gap: 10px; font-size: 11px; line-height: 14px;">
                        <span style="color: ${settings.color}; text-shadow: 1px 1px 0 #000;">${settings.text}</span>
                        <span style="color: #fff; font-weight: bold;">${netNeeded}</span>
                    </div>
                `;
            }
        });

        // If we have everything needed for all visible fabs
        if (htmlRows === '') {
            summaryBox.style.display = 'none';
            return;
        }

        summaryBox.style.display = 'block';
        summaryBox.innerHTML =
            '<div style="color: #fff; font-weight: bold; border-bottom: 1px solid #555; margin-bottom: 5px; padding-bottom: 2px;">MISSING PARTS</div>' +
            htmlRows;
    }

    setInterval(scanItems, 1000);

})();