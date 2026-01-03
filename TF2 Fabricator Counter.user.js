// ==UserScript==
// @name        TF2 Fabricator Counter (Fix Overwrites)
// @namespace   https://github.com/Raytr0
// @version     1.0
// @author      Raytr0
// @description Inventory support with BR/RI/PR abbreviations and fixed Robot Part naming.
// @match       *://steamcommunity.com/id/*/inventory*
// @match       *://steamcommunity.com/profiles/*/inventory*
// @match       *://steamcommunity.com/tradeoffer/*
// @grant       unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    const ATTR_FINISHED = 'data-fab-v6-3';
    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

    // --- Helpers ---

    function getDisplaySettings(fullName) {
        let clean = fullName;
        let color = '#ffcc00'; // Default Gold for Robot Parts

        // 1. Determine Color
        if (fullName.includes('Specialized Killstreak')) {
            color = '#32CD32'; // Green
        } else if (fullName.includes('Killstreak')) {
            color = '#b0b0b0'; // Gray
        }

        // 2. Abbreviate Prefixes
        // Replaces "Battle-Worn Robot" OR just "Battle-Worn" with "BR"
        clean = clean.replace(/Battle-Worn(?: Robot)?/g, 'BR');
        clean = clean.replace(/Reinforced(?: Robot)?/g, 'RI');
        clean = clean.replace(/Pristine(?: Robot)?/g, 'PR');

        // 3. Remove Fluff
        clean = clean
            .replace('Unique ', '')
            .replace('Killstreak ', '')
            .replace('Specialized ', '')
            .replace('Professional ', '')
            .replace('Item', '')
            .trim();

        // 4. Shorten Specific Part Names (Using replace so we don't delete the BR/RI prefix)
        clean = clean.replace('Money Furnace', 'Furnace');
        clean = clean.replace('Taunt Processor', 'Processor');
        clean = clean.replace('KB-808', 'KB');

        // 5. Truncate if still too long
        if (clean.length > 18) {
            clean = clean.substring(0, 15) + '..';
        }

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
                ingredients.push({ name: matchX[1].trim(), count: matchX[2] });
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
                    if (desc) {
                        return { ...asset, descriptions: desc.descriptions, market_hash_name: desc.market_hash_name };
                    }
                }
            }
        }
        return null;
    }

    // --- Main Logic ---

    function scanItems() {
        const items = document.querySelectorAll('.item:not([data-fab-v6-3="true"])');

        items.forEach(item => {
            const data = getItemData(item);
            if (!data) return;

            const rawName = data.market_hash_name || "";

            if (!rawName.includes('Fabricator')) {
                item.setAttribute(ATTR_FINISHED, 'true');
                return;
            }

            const ingredients = getIngredients(data.descriptions);

            const container = document.createElement('div');
            container.style.position = 'absolute';
            container.style.top = '1px';
            container.style.right = '2px';
            container.style.textAlign = 'right';
            container.style.pointerEvents = 'none';
            container.style.zIndex = '10';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';

            if (ingredients.length > 0) {
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
            } else {
                const line = document.createElement('div');
                line.innerText = "?";
                line.style.color = '#ff0000';
                line.style.fontSize = '10px';
                line.style.fontWeight = 'bold';
                container.appendChild(line);
            }

            item.appendChild(container);
            item.setAttribute(ATTR_FINISHED, 'true');
        });
    }

    setInterval(scanItems, 1000);

})();