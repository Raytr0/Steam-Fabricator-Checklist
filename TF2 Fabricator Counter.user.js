// ==UserScript==
// @name        TF2 Fabricator Counter (Initials Mode)
// @namespace   https://github.com/Raytr0
// @version     2.2
// @author      Raytr0
// @description Overlays Initials (MF, TP, etc.) on items, keeps full names in Summary.
// @match       *://steamcommunity.com/id/*/inventory*
// @match       *://steamcommunity.com/profiles/*/inventory*
// @match       *://steamcommunity.com/tradeoffer/*
// @grant       unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    const ATTR_FINISHED = 'data-fab-v10-0';
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
        let initials = "";
        let color = '#ffcc00'; // Default Gold

        // 1. Clean Fluff
        clean = clean
            .replace('Unique ', '')
            .replace('Item', '')
            .trim();

        // 2. Determine Color & Tier Label
        if (clean.includes('Specialized Killstreak')) {
            color = '#32CD32'; // Green
            clean = clean.replace('Specialized Killstreak', 'Spec KS');
            initials = 'Spec KS'; // Keep KS legible
        } else if (clean.includes('Killstreak')) {
            if (clean.includes('Professional Killstreak')) {
                color = '#FFD700';
                clean = clean.replace('Professional Killstreak', 'Pro KS');
                initials = 'Pro KS';
            } else {
                color = '#b0b0b0'; // Gray
                clean = clean.replace('Killstreak', 'Basic KS');
                initials = 'Basic KS';
            }
        }
        else {
            // 3. Custom Colors & Initials for Robot Parts
            if (fullName.includes('KB-808')) {
                color = '#FF9900';
                initials = 'KB';
                clean = clean.replace('KB-808', 'KB');
            }
            else if (fullName.includes('Money Furnace')) {
                color = '#7B9095';
                initials = 'MF';
                clean = clean.replace('Money Furnace', 'Furnace');
            }
            else if (fullName.includes('Taunt Processor')) {
                color = '#0099FF';
                initials = 'TP';
                clean = clean.replace('Taunt Processor', 'Processor');
            }
            else if (fullName.includes('Emotion Detector')) {
                color = '#55FF55';
                initials = 'ED';
                clean = clean.replace('Emotion Detector', 'Emotion');
            }
            else if (fullName.includes('Bomb Stabilizer')) {
                color = '#FF4444';
                initials = 'BS';
                clean = clean.replace('Bomb Stabilizer', 'Bomb Stab.');
            }
            else if (fullName.includes('Humor Suppression')) {
                color = '#E3E3C5';
                initials = 'HS';
                clean = clean.replace('Humor Suppression Pump', 'Humor Pump');
            }
            else if (fullName.includes('Currency Digester')) {
                color = '#FF66AA';
                initials = 'CD';
                clean = clean.replace('Currency Digester', 'Digester');
            }
            else if (fullName.includes('Brainstorm Bulb')) {
                color = '#f5dc98';
                initials = 'BB';
                clean = clean.replace('Brainstorm Bulb', 'Bulb');
            }
        }

        // 4. Handle Prefixes (BR/RI/PR)
        // We want the prefix in BOTH clean name and initials
        // e.g. "Battle-Worn Robot Money Furnace" -> Clean: "BR Furnace", Initials: "BR MF"

        const hasBR = /Battle-Worn(?: Robot)?/.test(fullName);
        const hasRI = /Reinforced(?: Robot)?/.test(fullName);
        const hasPR = /Pristine(?: Robot)?/.test(fullName);

        let prefix = "";
        if (hasBR) prefix = "BR";
        else if (hasRI) prefix = "RI";
        else if (hasPR) prefix = "PR";

        // Apply prefix to our shortened text versions
        if (prefix) {
            // Clean up the original long prefix from 'clean'
            clean = clean.replace(/Battle-Worn(?: Robot)?/g, '')
                .replace(/Reinforced(?: Robot)?/g, '')
                .replace(/Pristine(?: Robot)?/g, '')
                .trim();

            // Re-attach short prefix
            clean = `${prefix} ${clean}`;
            initials = `${prefix} ${initials}`;
        }

        // Final fallback if initials are empty (for weird items)
        if (!initials) initials = clean.substring(0, 4);

        // Truncate clean text for summary box
        if (clean.length > 22) clean = clean.substring(0, 20) + '..';

        return { text: clean, initials: initials, color: color };
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

        let globalNeeded = {};
        let globalOwned = {};
        let fabricatorFound = false;

        allItems.forEach(item => {
            let data = null;
            if (item.fabCachedData) {
                data = item.fabCachedData;
            } else {
                data = getItemData(item);
                if (data) item.fabCachedData = data;
            }

            if (!data) return;

            const rawName = data.market_hash_name || "";
            const isFabricator = rawName.includes('Fabricator');

            if (isFabricator) {
                fabricatorFound = true;
                let ingredients = item.fabCachedIngredients;
                if (!ingredients) {
                    ingredients = getIngredients(data.descriptions);
                    item.fabCachedIngredients = ingredients;
                }

                ingredients.forEach(ing => {
                    if (!globalNeeded[ing.name]) globalNeeded[ing.name] = 0;
                    globalNeeded[ing.name] += ing.count;
                });

                if (!item.getAttribute(ATTR_FINISHED)) {
                    renderOverlay(item, ingredients);
                    item.setAttribute(ATTR_FINISHED, 'true');
                }

            } else {
                let count = 1;
                if (data.amount) count = parseInt(data.amount);
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
            // USE INITIALS HERE
            line.innerText = `${ing.count} x ${settings.initials}`;
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
            const ownedCount = owned[name] || 0;
            const netNeeded = neededCount - ownedCount;

            if (netNeeded > 0) {
                const settings = getDisplaySettings(name);
                htmlRows += `
                    <div style="display: flex; justify-content: space-between; gap: 10px; font-size: 11px; line-height: 14px;">
                        <span style="color: ${settings.color}; text-shadow: 1px 1px 0 #000;">
                            ${settings.text}
                        </span>
                        <span style="color: #fff; font-weight: bold;">${netNeeded}</span>
                    </div>
                `;
            }
        });

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