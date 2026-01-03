// ==UserScript==
// @name        TF2 Fabricator Counter (v27 - Clean Split)
// @namespace   https://github.com/Raytr0
// @version     3.2
// @author      Raytr0
// @description Trade Window runs v2.2 logic (DOM). Inventory Window runs API logic. Zero interference.
// @match       *://steamcommunity.com/id/*/inventory*
// @match       *://steamcommunity.com/profiles/*/inventory*
// @match       *://steamcommunity.com/tradeoffer/*
// @grant       unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const isTradePage = window.location.href.includes('tradeoffer');

    // --- SHARED UI ---
    const summaryBox = document.createElement('div');
    summaryBox.id = 'fab_total_summary';
    summaryBox.style.position = 'fixed';
    summaryBox.style.top = isTradePage ? '60px' : '115px';
    summaryBox.style.left = '10px';
    summaryBox.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    summaryBox.style.border = '2px solid #7D6D00';
    summaryBox.style.borderRadius = '4px';
    summaryBox.style.padding = '8px';
    summaryBox.style.zIndex = '99999';
    summaryBox.style.fontFamily = 'Arial, sans-serif';
    summaryBox.style.minWidth = '160px';
    summaryBox.style.pointerEvents = 'none';
    summaryBox.style.display = 'none';
    document.body.appendChild(summaryBox);

    // =========================================================================
    // HELPER: Display Settings (Colors & Initials) - Shared for Consistency
    // =========================================================================
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

    // =========================================================================
    // MODE 1: TRADE OFFER (The exact code from v2.2 logic)
    // =========================================================================
    if (isTradePage) {
        console.log("[TF2-Fab] Trade Mode Activated");
        summaryBox.style.display = 'block';
        summaryBox.innerHTML = '<div style="color:#aaa;">Scanning Trade...</div>';

        // Helper: Parse Ingredients (DOM Version)
        const getIngredients = (descriptionArray) => {
            if (!descriptionArray) return [];
            let ingredients = [];
            for (let lineObj of descriptionArray) {
                let text = lineObj.value ? String(lineObj.value).trim() : "";
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
        };

        const renderTradeOverlay = (item, ingredients) => {
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
        };

        const scanItemsTrade = () => {
            const allItems = document.querySelectorAll('.item');
            let globalNeeded = {};
            let globalOwned = {};
            let fabricatorFound = false;

            allItems.forEach(item => {
                // In trade mode, we rely on 'rgItem' being attached to the element
                let data = item.rgItem;
                if (!data) return;

                const rawName = data.market_hash_name || "";

                if (rawName.includes('Fabricator')) {
                    fabricatorFound = true;
                    // Cache parsing
                    let ingredients = item.fabCachedIngredients;
                    if (!ingredients) {
                        ingredients = getIngredients(data.descriptions);
                        item.fabCachedIngredients = ingredients;
                    }

                    ingredients.forEach(ing => {
                        if (!globalNeeded[ing.name]) globalNeeded[ing.name] = 0;
                        globalNeeded[ing.name] += ing.count;
                    });

                    if (!item.getAttribute('data-fab-trade-done')) {
                        renderTradeOverlay(item, ingredients);
                        item.setAttribute('data-fab-trade-done', 'true');
                    }
                } else {
                    let count = 1;
                    // Trade/Inv items usually 1, but check amount just in case
                    if (data.amount) count = parseInt(data.amount);
                    if (!globalOwned[rawName]) globalOwned[rawName] = 0;
                    globalOwned[rawName] += count;
                }
            });

            // Update Summary
            if (!fabricatorFound) {
                summaryBox.style.display = 'none';
                return;
            }

            let htmlRows = '';
            const names = Object.keys(globalNeeded).sort();
            let missingCount = 0;

            names.forEach(name => {
                const neededCount = globalNeeded[name];
                const ownedCount = globalOwned[name] || 0;
                const netNeeded = neededCount - ownedCount;

                if (netNeeded > 0) {
                    missingCount++;
                    const settings = getDisplaySettings(name);
                    htmlRows += `
                        <div style="display: flex; justify-content: space-between; gap: 10px; font-size: 11px; line-height: 14px;">
                            <span style="color: ${settings.color}; text-shadow: 1px 1px 0 #000;">${settings.text}</span>
                            <span style="color: #fff; font-weight: bold;">${netNeeded}</span>
                        </div>`;
                }
            });

            if (missingCount === 0) {
                summaryBox.style.display = 'none'; // Hide if complete
            } else {
                summaryBox.style.display = 'block';
                summaryBox.innerHTML = '<div style="color: #fff; font-weight: bold; border-bottom: 1px solid #555; margin-bottom: 5px; padding-bottom: 2px;">MISSING PARTS</div>' + htmlRows;
            }
        };

        setInterval(scanItemsTrade, 1000);
    }

        // =========================================================================
        // MODE 2: INVENTORY PAGE (API Method)
    // =========================================================================
    else {
        console.log("[TF2-Fab] Inventory Mode Activated (API)");
        summaryBox.style.display = 'block';
        summaryBox.innerHTML = '<div style="color:#aaa;">Loading API...</div>';

        let INVENTORY_DATA = {};
        let OWNED_PARTS = {};
        let NEEDED_PARTS = {};

        const parseApiIngredients = (descriptionArray) => {
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
        };

        const renderInvOverlay = (item, ingredients) => {
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
        };

        const updateInvSummary = () => {
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

            if (!hasMissing) html += '<div style="color:#888; font-size:10px;">Complete!</div>';
            summaryBox.innerHTML = html;
        };

        const loadInventory = async () => {
            let url = window.location.href.split('/inventory')[0] + '/inventory/json/440/2?l=english&count=5000';

            try {
                const response = await fetch(url);
                const json = await response.json();

                if (!json.success && json.success !== 1) {
                    summaryBox.innerHTML = '<div style="color:red">API Error</div>';
                    return;
                }

                // Dual Format Fix: Check 'assets' OR 'rgInventory'
                const rawItems = json.assets || json.rgInventory;
                if (!rawItems) {
                    summaryBox.innerHTML = '<div style="color:yellow">Empty</div>';
                    return;
                }

                // Dual Format Fix: Check 'descriptions' OR 'rgDescriptions'
                const rawDescs = json.descriptions || json.rgDescriptions || [];
                const descMap = {};

                // Map descriptions
                if (Array.isArray(rawDescs)) {
                    rawDescs.forEach(d => { descMap[d.classid + '_' + d.instanceid] = d; });
                } else {
                    Object.assign(descMap, rawDescs);
                }

                // Convert items to Array
                const items = Array.isArray(rawItems) ? rawItems : Object.values(rawItems);

                items.forEach(item => {
                    let descKey = item.classid + '_' + item.instanceid;
                    let desc = descMap[descKey];
                    if (!desc) return;

                    let rawName = desc.market_hash_name || "";

                    if (rawName.includes('Fabricator')) {
                        let ingredients = parseApiIngredients(desc.descriptions);
                        // Store BOTH id and assetid
                        INVENTORY_DATA[item.id || item.assetid] = { ingredients: ingredients };

                        ingredients.forEach(ing => {
                            if (!NEEDED_PARTS[ing.name]) NEEDED_PARTS[ing.name] = 0;
                            NEEDED_PARTS[ing.name] += ing.count;
                        });
                    } else {
                        if (!OWNED_PARTS[rawName]) OWNED_PARTS[rawName] = 0;
                        OWNED_PARTS[rawName] += 1;
                    }
                });

                updateInvSummary();

                // Start observer for overlays
                const observer = new MutationObserver(() => {
                    const elements = document.querySelectorAll('.item');
                    elements.forEach(el => {
                        if (el.getAttribute('data-fab-inv-done')) return;
                        if (!el.id) return;

                        let parts = el.id.split('_');
                        if (parts[0].startsWith('item')) parts[0] = parts[0].replace('item', '');
                        if (parts.length < 3) return;
                        let assetId = parts[2];

                        let data = INVENTORY_DATA[assetId];
                        if (data) {
                            renderInvOverlay(el, data.ingredients);
                            el.setAttribute('data-fab-inv-done', 'true');
                        }
                    });
                });
                observer.observe(document.body, { childList: true, subtree: true });

            } catch (e) {
                console.error(e);
                summaryBox.innerHTML = '<div style="color:red">Fetch Failed</div>';
            }
        };

        loadInventory();
    }

})();