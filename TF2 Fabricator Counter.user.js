// ==UserScript==
// @name        TF2 Fabricator Counter (API Version)
// @namespace   https://github.com/Raytr0
// @version     3.0
// @author      Raytr0
// @description Uses the Steam API to calculate totals for the ENTIRE inventory instantly.
// @match       *://steamcommunity.com/id/*/inventory*
// @match       *://steamcommunity.com/profiles/*/inventory*
// @match       *://steamcommunity.com/tradeoffer/*
// @grant       none
// ==/UserScript==

(function() {
    'use strict';

    // --- UI: Summary Box ---
    const summaryBox = document.createElement('div');
    summaryBox.id = 'fab_total_summary';
    summaryBox.style.position = 'fixed';
    summaryBox.style.top = '110px';
    summaryBox.style.left = '10px';
    summaryBox.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    summaryBox.style.border = '2px solid #7D6D00';
    summaryBox.style.borderRadius = '4px';
    summaryBox.style.padding = '8px';
    summaryBox.style.zIndex = '99999';
    summaryBox.style.fontFamily = 'Arial, sans-serif';
    summaryBox.style.minWidth = '160px';
    summaryBox.innerHTML = '<div style="color:#aaa; font-size:10px;">Loading API...</div>';
    document.body.appendChild(summaryBox);

    // --- State ---
    let INVENTORY_DATA = {}; // Maps AssetID -> { ingredients: [], isFab: bool }
    let OWNED_PARTS = {};    // Maps PartName -> Count
    let NEEDED_PARTS = {};   // Maps PartName -> Count

    // --- Helper: Settings ---
    function getDisplaySettings(fullName) {
        let clean = fullName.replace('Unique ', '').replace('Item', '').trim();
        let initials = "";
        let color = '#ffcc00';

        if (clean.includes('Specialized Killstreak')) {
            color = '#32CD32'; clean = clean.replace('Specialized Killstreak', 'Spec KS'); initials = 'Spec KS';
        } else if (clean.includes('Killstreak')) {
            if (clean.includes('Professional Killstreak')) { color = '#FFD700'; clean = clean.replace('Professional Killstreak', 'Pro KS'); initials = 'Pro KS'; }
            else { color = '#b0b0b0'; clean = clean.replace('Killstreak', 'Basic KS'); initials = 'Basic KS'; }
        } else {
            if (fullName.includes('KB-808')) { color = '#FF9900'; initials = 'KB'; clean = clean.replace('KB-808', 'KB'); }
            else if (fullName.includes('Money Furnace')) { color = '#7B9095'; initials = 'MF'; clean = clean.replace('Money Furnace', 'Furnace'); }
            else if (fullName.includes('Taunt Processor')) { color = '#0099FF'; initials = 'TP'; clean = clean.replace('Taunt Processor', 'Processor'); }
            else if (fullName.includes('Emotion Detector')) { color = '#55FF55'; initials = 'ED'; clean = clean.replace('Emotion Detector', 'Emotion'); }
            else if (fullName.includes('Bomb Stabilizer')) { color = '#FF4444'; initials = 'BS'; clean = clean.replace('Bomb Stabilizer', 'Bomb Stab.'); }
            else if (fullName.includes('Humor Suppression')) { color = '#E3E3C5'; initials = 'HS'; clean = clean.replace('Humor Suppression Pump', 'Humor Pump'); }
            else if (fullName.includes('Currency Digester')) { color = '#FF66AA'; initials = 'CD'; clean = clean.replace('Currency Digester', 'Digester'); }
            else if (fullName.includes('Brainstorm Bulb')) { color = '#f5dc98'; initials = 'BB'; clean = clean.replace('Brainstorm Bulb', 'Bulb'); }
        }

        const hasBR = /Battle-Worn(?: Robot)?/.test(fullName);
        const hasRI = /Reinforced(?: Robot)?/.test(fullName);
        const hasPR = /Pristine(?: Robot)?/.test(fullName);
        let prefix = hasBR ? "BR" : (hasRI ? "RI" : (hasPR ? "PR" : ""));

        if (prefix) {
            clean = clean.replace(/Battle-Worn(?: Robot)?/g, '').replace(/Reinforced(?: Robot)?/g, '').replace(/Pristine(?: Robot)?/g, '').trim();
            clean = `${prefix} ${clean}`;
            initials = `${prefix} ${initials}`;
        }

        if (!initials) initials = clean.substring(0, 4);
        return { text: clean, initials: initials, color: color };
    }

    // --- Helper: Parsing ---
    function parseIngredients(descriptionArray) {
        if (!descriptionArray) return [];
        let ingredients = [];
        for (let line of descriptionArray) {
            let text = line.value ? String(line.value).trim() : "";
            if (!text || text.includes("must be fulfilled") || text === "Inputs:") continue;
            let matchX = text.match(/(.*?) x (\d+)/);
            let matchProgress = text.match(/\((\d+)\/(\d+)\)\s*(.*)/);
            if (matchX) ingredients.push({ name: matchX[1].trim(), count: parseInt(matchX[2]) });
            else if (matchProgress) {
                let current = parseInt(matchProgress[1]);
                let max = parseInt(matchProgress[2]);
                if (current < max) ingredients.push({ name: matchProgress[3].trim(), count: max - current });
            }
        }
        return ingredients;
    }

    // --- CORE: Fetch Inventory API ---
    async function loadInventory() {
        // 1. Get Steam ID from URL
        const url = window.location.href;
        let inventoryUrl = "";

        // Handle: steamcommunity.com/id/CUSTOM_URL/inventory
        // Handle: steamcommunity.com/profiles/76561198xxxx/inventory
        if (url.includes('/inventory')) {
            let baseUrl = url.split('/inventory')[0];
            inventoryUrl = `${baseUrl}/inventory/json/440/2?l=english&count=5000`; // JSON endpoint
        } else if (url.includes('tradeoffer')) {
            // Trade offers are harder because we need the partner's ID or our ID.
            // For now, this API logic is primarily for the INVENTORY page.
            // We'll fallback to DOM scanning for Trade Offers if needed, or extract ID from page variables.
            // Let's focus on the Inventory Page fix first.
            return;
        }

        console.log(`[TF2-Fab] Fetching: ${inventoryUrl}`);

        try {
            const response = await fetch(inventoryUrl);
            const json = await response.json();

            if (!json.success) {
                summaryBox.innerHTML = '<div style="color:red">API Error</div>';
                return;
            }

            // 2. Process Data
            const descriptions = {}; // ClassID_InstanceID -> Description Object

            // Map descriptions for easy lookup
            if (json.rgDescriptions) {
                for (let key in json.rgDescriptions) {
                    descriptions[key] = json.rgDescriptions[key];
                }
            }

            // Process Assets (The actual items)
            if (json.rgInventory) {
                for (let key in json.rgInventory) {
                    let item = json.rgInventory[key];
                    let descKey = item.classid + '_' + item.instanceid;
                    let desc = descriptions[descKey];

                    if (!desc) continue;

                    let rawName = desc.market_hash_name || "";

                    if (rawName.includes('Fabricator')) {
                        // It's a Fabricator
                        let ingredients = parseIngredients(desc.descriptions);

                        // Store for Overlay
                        INVENTORY_DATA[item.id] = { ingredients: ingredients, isFab: true };

                        // Add to Totals
                        ingredients.forEach(ing => {
                            if (!NEEDED_PARTS[ing.name]) NEEDED_PARTS[ing.name] = 0;
                            NEEDED_PARTS[ing.name] += ing.count;
                        });
                    } else {
                        // It's a Part (or something else)
                        // Add to Owned Totals
                        // Note: rgInventory items are single instances usually.
                        if (!OWNED_PARTS[rawName]) OWNED_PARTS[rawName] = 0;
                        OWNED_PARTS[rawName] += 1;
                    }
                }
            }

            updateSummaryBox();
            scanDomForOverlays(); // Apply to currently visible items

        } catch (e) {
            console.error(e);
            summaryBox.innerHTML = '<div style="color:red">Fetch Failed</div>';
        }
    }

    // --- UI: Update Summary ---
    function updateSummaryBox() {
        let html = '<div style="color: #fff; font-weight: bold; border-bottom: 1px solid #555; margin-bottom: 5px; padding-bottom: 2px;">MISSING PARTS</div>';
        let hasMissing = false;

        let names = Object.keys(NEEDED_PARTS).sort();

        for (let name of names) {
            let needed = NEEDED_PARTS[name];
            let owned = OWNED_PARTS[name] || 0;
            let missing = needed - owned;

            if (missing > 0) {
                hasMissing = true;
                let s = getDisplaySettings(name);
                html += `
                    <div style="display: flex; justify-content: space-between; gap: 10px; font-size: 11px; line-height: 14px;">
                        <span style="color: ${s.color}; text-shadow: 1px 1px 0 #000;">${s.text}</span>
                        <span style="color: #fff; font-weight: bold;">${missing}</span>
                    </div>`;
            }
        }

        if (!hasMissing) html += '<div style="color:#888; font-size:10px;">None!</div>';
        summaryBox.innerHTML = html;
        summaryBox.style.display = 'block';
    }

    // --- UI: Dom Scanner ---
    function scanDomForOverlays() {
        // Find all visible item elements
        const elements = document.querySelectorAll('.item');

        elements.forEach(el => {
            // If already processed, skip
            if (el.getAttribute('data-fab-done')) return;

            // Extract Asset ID from Element ID
            // Format: "440_2_123456" OR "item440_2_123456"
            if (!el.id) return;

            let parts = el.id.split('_');
            // Remove "item" prefix if present in the first part
            if (parts[0].startsWith('item')) parts[0] = parts[0].replace('item', '');

            if (parts.length < 3) return;
            let assetId = parts[2];

            // Look up in our API Data
            let data = INVENTORY_DATA[assetId];

            if (data && data.isFab) {
                renderOverlay(el, data.ingredients);
                el.setAttribute('data-fab-done', 'true');
            }
        });
    }

    function renderOverlay(item, ingredients) {
        // Prevent dupes
        if (item.querySelector('.fab-overlay')) return;

        const container = document.createElement('div');
        container.className = 'fab-overlay';
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

    // --- Initialization ---
    // 1. Run immediately
    loadInventory();

    // 2. Watch for DOM changes (scrolling loads new divs)
    const observer = new MutationObserver((mutations) => {
        scanDomForOverlays();
    });
    observer.observe(document.body, { childList: true, subtree: true });

})();