// ==UserScript==
// @name        TF2 Fabricator Counter (v3.3 - KS Abbreviations)
// @namespace   https://github.com/Raytr0
// @version     3.3
// @author      Raytr0
// @description Trade Window runs v2.2 logic (DOM). Inventory Window runs API logic. Overlay is Top-Left. Displays Sheen (AE, DD) and KS (CD, FH) codes.
// @match       *://steamcommunity.com/id/*/inventory*
// @match       *://steamcommunity.com/profiles/*/inventory*
// @match       *://steamcommunity.com/tradeoffer/*
// @grant       unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const isTradePage = window.location.href.includes('tradeoffer');

    // =========================================================================
    // DATA: Sheen Codes & Colors
    // =========================================================================
    const SHEEN_DATA = {
        'Agonizing Emerald': { code: 'AE', color: '#28FF46' },
        'Deadly Daffodil':   { code: 'DD', color: '#F2AC0A' },
        'Hot Rod':           { code: 'HR', color: '#FF1EFF' },
        'Manndarin':         { code: 'MA', color: '#FF4B05' },
        'Mean Green':        { code: 'MG', color: '#64FF0A' },
        'Team Shine':        { code: 'TS', color: '#FF7676' },
        'Villainous Violet': { code: 'VV', color: '#6914FF' }
    };

    // =========================================================================
    // DATA: Killstreaker Codes
    // =========================================================================
    const KILLSTREAKER_DATA = {
        'Cerebral Discharge': 'CD',
        'Fire Horns':         'FH',
        'Flames':             'FLA',
        'Hypno-Beam':         'HB',
        'Incinerator':        'INC',
        'Singularity':        'SIN',
        'Tornado':            'TOR'
    };

    // =========================================================================
    // CSS STYLES: Top-Left Positioning
    // =========================================================================
    const style = document.createElement('style');
    style.innerHTML = `
        .fab-overlay {
            position: absolute;
            top: 2px;
            left: 3px;
            text-align: left;
            pointer-events: none;
            z-index: 10;
            display: flex;
            flex-direction: column;
        }
        .fab-row {
            display: flex;
            align-items: center;
            justify-content: flex-start;
            margin-bottom: 1px;
            font-size: 10px;
            line-height: 10px;
            font-family: Arial, sans-serif;
            font-weight: bold;
            text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 2px 2px 0px #000;
        }
    `;
    document.head.appendChild(style);

    // --- SHARED UI (Summary Box) ---
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
    // HELPER: Strip HTML
    // =========================================================================
    function stripHtml(html) {
        let tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }

    // =========================================================================
    // HELPER: Display Settings (Ingredients)
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
    // HELPER: Create DOM Row
    // =========================================================================
    function createRow(text, color) {
        const row = document.createElement('div');
        row.className = 'fab-row';

        const span = document.createElement('span');
        span.innerText = text;
        span.style.color = color;
        row.appendChild(span);
        return row;
    }

    // =========================================================================
    // HELPER: Unified Parser
    // =========================================================================
    function parseItemDetails(descriptionArray) {
        let result = {
            ingredients: [],
            sheenCode: null,
            sheenColor: '#fff',
            ksCode: null
        };

        if (!descriptionArray) return result;

        for (let lineObj of descriptionArray) {
            let rawVal = lineObj.value || "";
            let text = stripHtml(rawVal).trim();
            if (!text || text.includes("must be fulfilled")) continue;

            // 1. Ingredients
            let matchX = text.match(/(.*?) x (\d+)/);
            let matchProgress = text.match(/\((\d+)\/(\d+)\)\s*(.*)/);

            if (matchX && !text.includes("Inputs:")) {
                result.ingredients.push({ name: matchX[1].trim(), count: parseInt(matchX[2]) });
            } else if (matchProgress) {
                let current = parseInt(matchProgress[1]);
                let max = parseInt(matchProgress[2]);
                if (current < max) result.ingredients.push({ name: matchProgress[3].trim(), count: max - current });
            }

            // 2. Sheen Detection
            if (text.includes('Sheen:')) {
                let parts = text.split('Sheen:');
                if (parts.length > 1) {
                    let sheenName = parts[1].trim();
                    for (let key in SHEEN_DATA) {
                        if (sheenName.includes(key)) {
                            result.sheenCode = SHEEN_DATA[key].code;
                            result.sheenColor = SHEEN_DATA[key].color;
                            break;
                        }
                    }
                    if (!result.sheenCode) result.sheenCode = "??";
                }
            }

            // 3. Killstreaker Detection
            if (text.includes('Killstreaker:')) {
                let parts = text.split('Killstreaker:');
                if (parts.length > 1) {
                    let ksName = parts[1].trim();
                    for (let key in KILLSTREAKER_DATA) {
                        if (ksName.includes(key)) {
                            result.ksCode = KILLSTREAKER_DATA[key];
                            break;
                        }
                    }
                    // If no abbreviation found, fallback to first 3 chars
                    if (!result.ksCode) result.ksCode = ksName.substring(0,3).toUpperCase();
                }
            }
        }
        return result;
    }

    // =========================================================================
    // MODE 1: TRADE OFFER
    // =========================================================================
    if (isTradePage) {
        console.log("[TF2-Fab] Trade Mode Activated");
        summaryBox.style.display = 'block';
        summaryBox.innerHTML = '<div style="color:#aaa;">Scanning Trade...</div>';

        const renderTradeOverlay = (item, details) => {
            const container = document.createElement('div');
            container.className = 'fab-overlay';

            // Render Sheen Code
            if (details.sheenCode) {
                container.appendChild(createRow(details.sheenCode, details.sheenColor));
            }
            // Render Killstreaker Code
            if (details.ksCode) {
                // Use white text for KS to keep it clean, or could use sheenColor
                container.appendChild(createRow(`KS: ${details.ksCode}`, '#ccc'));
            }

            // Render Ingredients
            details.ingredients.forEach(ing => {
                const settings = getDisplaySettings(ing.name);
                container.appendChild(createRow(`${ing.count} x ${settings.initials}`, settings.color));
            });
            item.appendChild(container);
        };

        const scanItemsTrade = () => {
            const allItems = document.querySelectorAll('.item');
            let globalNeeded = {};
            let globalOwned = {};
            let fabricatorFound = false;

            allItems.forEach(item => {
                let data = item.rgItem;
                if (!data) return;

                const rawName = data.market_hash_name || "";

                if (rawName.includes('Fabricator') || rawName.includes('Kit')) {
                    fabricatorFound = true;
                    if (!item.getAttribute('data-fab-trade-done')) {
                        let details = parseItemDetails(data.descriptions);
                        item.fabCachedIngredients = details.ingredients;
                        renderTradeOverlay(item, details);
                        item.setAttribute('data-fab-trade-done', 'true');
                    }

                    if (item.fabCachedIngredients) {
                        item.fabCachedIngredients.forEach(ing => {
                            if (!globalNeeded[ing.name]) globalNeeded[ing.name] = 0;
                            globalNeeded[ing.name] += ing.count;
                        });
                    }
                } else {
                    let count = 1;
                    if (data.amount) count = parseInt(data.amount);
                    if (!globalOwned[rawName]) globalOwned[rawName] = 0;
                    globalOwned[rawName] += count;
                }
            });

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
                summaryBox.style.display = 'none';
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

        const renderInvOverlay = (item, details) => {
            if (item.querySelector('.fab-overlay')) return;
            const container = document.createElement('div');
            container.className = 'fab-overlay';

            // Render Sheen Code
            if (details.sheenCode) {
                container.appendChild(createRow(details.sheenCode, details.sheenColor));
            }
            // Render Killstreaker Code
            if (details.ksCode) {
                container.appendChild(createRow(`KS: ${details.ksCode}`, '#ccc'));
            }

            // Render Ingredients
            details.ingredients.forEach(ing => {
                const settings = getDisplaySettings(ing.name);
                container.appendChild(createRow(`${ing.count} x ${settings.initials}`, settings.color));
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

                const rawItems = json.assets || json.rgInventory;
                if (!rawItems) {
                    summaryBox.innerHTML = '<div style="color:yellow">Empty</div>';
                    return;
                }

                const rawDescs = json.descriptions || json.rgDescriptions || [];
                const descMap = {};

                if (Array.isArray(rawDescs)) {
                    rawDescs.forEach(d => { descMap[d.classid + '_' + d.instanceid] = d; });
                } else {
                    Object.assign(descMap, rawDescs);
                }

                const items = Array.isArray(rawItems) ? rawItems : Object.values(rawItems);

                items.forEach(item => {
                    let descKey = item.classid + '_' + item.instanceid;
                    let desc = descMap[descKey];
                    if (!desc) return;

                    let rawName = desc.market_hash_name || "";

                    if (rawName.includes('Fabricator') || rawName.includes('Kit')) {
                        let details = parseItemDetails(desc.descriptions);
                        INVENTORY_DATA[item.id || item.assetid] = details;

                        details.ingredients.forEach(ing => {
                            if (!NEEDED_PARTS[ing.name]) NEEDED_PARTS[ing.name] = 0;
                            NEEDED_PARTS[ing.name] += ing.count;
                        });
                    } else {
                        if (!OWNED_PARTS[rawName]) OWNED_PARTS[rawName] = 0;
                        OWNED_PARTS[rawName] += 1;
                    }
                });

                updateInvSummary();

                const observer = new MutationObserver(() => {
                    const elements = document.querySelectorAll('.item');
                    elements.forEach(el => {
                        if (el.getAttribute('data-fab-inv-done')) return;
                        if (!el.id) return;

                        let parts = el.id.split('_');
                        if (parts[0].startsWith('item')) parts[0] = parts[0].replace('item', '');
                        if (parts.length < 3) return;
                        let assetId = parts[2];

                        let details = INVENTORY_DATA[assetId];
                        if (details) {
                            renderInvOverlay(el, details);
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