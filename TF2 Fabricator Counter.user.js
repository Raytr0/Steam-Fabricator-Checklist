// ==UserScript==
// @name        TF2 Fabricator Counter
// @namespace   https://github.com/Raytr0
// @version     4.0.1
// @author      Raytr0
// @description Fixed "Initializing" bug when toggling the missing parts box.
// @match       *://steamcommunity.com/id/*/inventory*
// @match       *://steamcommunity.com/profiles/*/inventory*
// @match       *://steamcommunity.com/tradeoffer/*
// @match       *://steamcommunity.com/market/listings/440/*
// @match       *://steamcommunity.com/market/search*
// @updateURL   https://github.com/Raytr0/Steam-Fabricator-Checklist/raw/refs/heads/main/TF2%20Fabricator%20Counter.user.js
// @downloadURL https://github.com/Raytr0/Steam-Fabricator-Checklist/raw/refs/heads/main/TF2%20Fabricator%20Counter.user.js
// @grant       unsafeWindow
// ==/UserScript==

(function() {
    'use strict';

    const win = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;
    const isTradePage = window.location.href.includes('tradeoffer');
    const isMarketPage = window.location.href.includes('market');

    // Global trackers to prevent "Initializing" hang
    let INVENTORY_DATA = {}, OWNED_PARTS = {}, NEEDED_PARTS = {};
    let GLOBAL_TRADE_NEEDED = {}, GLOBAL_TRADE_OWNED = {};

    // =========================================================================
    // PERSISTENCE & SETTINGS
    // =========================================================================
    const DEFAULT_SETTINGS = {
        showSheen: true,
        showKS: true,
        showIngredients: true,
        showSummary: true
    };

    let settings = JSON.parse(localStorage.getItem('tf2_fab_settings')) || DEFAULT_SETTINGS;

    function saveSettings() {
        localStorage.setItem('tf2_fab_settings', JSON.stringify(settings));

        // Clear overlays for re-render
        document.querySelectorAll('.fab-overlay').forEach(el => el.remove());
        document.querySelectorAll('.item').forEach(el => {
            el.removeAttribute('data-fab-trade-done');
            el.removeAttribute('data-fab-inv-done');
        });
        document.querySelectorAll('.market_listing_row').forEach(el => el.removeAttribute('data-fab-market-done'));

        // Immediately refresh the text so it doesn't stay "Initializing"
        if (isTradePage) {
            updateTradeSummaryUI();
        } else if (!isMarketPage) {
            updateInvSummaryUI();
        }

        updateBoxVisibility();
    }

    // =========================================================================
    // DATA: Sheen & Killstreaker Codes (v3.3)
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

    const KILLSTREAKER_DATA = {
        'Cerebral Discharge': 'CD', 'Fire Horns': 'FH', 'Flames': 'FLA',
        'Hypno-Beam': 'HB', 'Incinerator': 'INC', 'Singularity': 'SIN', 'Tornado': 'TOR'
    };

    // =========================================================================
    // UI BOX & STYLES
    // =========================================================================
    const style = document.createElement('style');
    style.innerHTML = `
        .fab-overlay { position: absolute; top: 2px; left: 3px; text-align: left; pointer-events: none; z-index: 10; display: flex; flex-direction: column; }
        .fab-row { display: flex; align-items: center; justify-content: flex-start; margin-bottom: 1px; font-size: 10px; line-height: 10px; font-family: Arial, sans-serif; font-weight: bold; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 2px 2px 0px #000; }
        #fab_main_container {
            position: fixed; top: ${isTradePage ? '60px' : '115px'}; left: 10px;
            background: rgba(0, 0, 0, 0.9); border: 2px solid #7D6D00; border-radius: 4px;
            padding: 8px; z-index: 99999; font-family: Arial, sans-serif; min-width: 170px; color: white;
        }
        #fab_summary_list { margin-top: 5px; }
        #fab_settings_panel { display: none; border-top: 1px solid #555; padding-top: 8px; margin-top: 8px; }
        .fab-setting-item { display: flex; align-items: center; font-size: 11px; margin-bottom: 5px; cursor: pointer; color: #ccc; }
        .fab-setting-item:hover { color: #fff; }
        .fab-setting-item input { margin-right: 8px; cursor: pointer; }
        #fab_header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #7D6D00; padding-bottom: 3px; }
        #fab_gear_icon { cursor: pointer; opacity: 0.7; font-size: 14px; user-select: none; }
        #fab_gear_icon:hover { opacity: 1; transform: rotate(30deg); transition: 0.2s; }
    `;
    document.head.appendChild(style);

    const mainContainer = document.createElement('div');
    mainContainer.id = 'fab_main_container';
    mainContainer.innerHTML = `
        <div id="fab_header">
            <span style="font-weight:bold; font-size:11px; color:#7D6D00;">FABRICATOR HELPER</span>
            <div id="fab_gear_icon">⚙️</div>
        </div>
        <div id="fab_summary_list">Initializing...</div>
        <div id="fab_settings_panel">
            <label class="fab-setting-item"><input type="checkbox" data-opt="showSheen" ${settings.showSheen ? 'checked' : ''}> Sheen Codes</label>
            <label class="fab-setting-item"><input type="checkbox" data-opt="showKS" ${settings.showKS ? 'checked' : ''}> Killstreakers</label>
            <label class="fab-setting-item"><input type="checkbox" data-opt="showIngredients" ${settings.showIngredients ? 'checked' : ''}> Overlays</label>
            <label class="fab-setting-item"><input type="checkbox" data-opt="showSummary" ${settings.showSummary ? 'checked' : ''}> Missing Box</label>
        </div>
    `;
    document.body.appendChild(mainContainer);

    function updateBoxVisibility() {
        document.getElementById('fab_summary_list').style.display = settings.showSummary ? 'block' : 'none';
    }
    updateBoxVisibility();

    mainContainer.querySelector('#fab_gear_icon').onclick = () => {
        const panel = document.getElementById('fab_settings_panel');
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    };

    mainContainer.querySelectorAll('input').forEach(cb => {
        cb.onchange = (e) => {
            settings[e.target.dataset.opt] = e.target.checked;
            saveSettings();
        };
    });

    // =========================================================================
    // CORE FUNCTIONS (v3.3)
    // =========================================================================
    function stripHtml(html) {
        let tmp = document.createElement("DIV");
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || "";
    }

    function getDisplaySettings(fullName) {
        let clean = fullName.replace('Unique ', '').replace('Item', '').trim();
        let initials = ""; let color = '#ffcc00';
        if (clean.includes('Specialized Killstreak')) {
            color = '#32CD32'; clean = clean.replace('Specialized Killstreak', 'Spec KS'); initials = 'Spec KS';
        } else if (clean.includes('Professional Killstreak')) {
            color = '#FFD700'; clean = clean.replace('Professional Killstreak', 'Pro KS'); initials = 'Pro KS';
        } else if (clean.includes('Killstreak')) {
            color = '#b0b0b0'; clean = clean.replace('Killstreak', 'Basic KS'); initials = 'Basic KS';
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
            clean = `${prefix} ${clean}`; initials = `${prefix} ${initials}`;
        }
        if (!initials) initials = clean.substring(0, 4);
        return { text: clean, initials: initials, color: color };
    }

    function createRow(text, color) {
        const row = document.createElement('div'); row.className = 'fab-row';
        const span = document.createElement('span'); span.innerText = text; span.style.color = color;
        row.appendChild(span); return row;
    }

    function parseItemDetails(descriptionArray) {
        let result = { ingredients: [], sheenCode: null, sheenColor: '#fff', ksCode: null };
        if (!descriptionArray) return result;
        for (let lineObj of descriptionArray) {
            let text = stripHtml(lineObj.value || "").trim();
            if (!text || text.includes("must be fulfilled")) continue;
            let matchX = text.match(/(.*?) x (\d+)/);
            let matchProgress = text.match(/\((\d+)\/(\d+)\)\s*(.*)/);
            if (matchX && !text.includes("Inputs:")) result.ingredients.push({ name: matchX[1].trim(), count: parseInt(matchX[2]) });
            else if (matchProgress) {
                let current = parseInt(matchProgress[1]), max = parseInt(matchProgress[2]);
                if (current < max) result.ingredients.push({ name: matchProgress[3].trim(), count: max - current });
            }
            if (text.includes('Sheen:')) {
                let parts = text.split('Sheen:');
                if (parts.length > 1) {
                    let sheenName = parts[1].trim();
                    for (let key in SHEEN_DATA) { if (sheenName.includes(key)) { result.sheenCode = SHEEN_DATA[key].code; result.sheenColor = SHEEN_DATA[key].color; break; } }
                    if (!result.sheenCode) result.sheenCode = "??";
                }
            }
            if (text.includes('Killstreaker:')) {
                let parts = text.split('Killstreaker:');
                if (parts.length > 1) {
                    let ksName = parts[1].trim();
                    for (let key in KILLSTREAKER_DATA) { if (ksName.includes(key)) { result.ksCode = KILLSTREAKER_DATA[key]; break; } }
                    if (!result.ksCode) result.ksCode = ksName.substring(0,3).toUpperCase();
                }
            }
        }
        return result;
    }

    function renderFabOverlay(item, details, forceNoIngredients = false) {
        if (item.querySelector('.fab-overlay')) return;
        const container = document.createElement('div'); container.className = 'fab-overlay';
        if (settings.showSheen && details.sheenCode) container.appendChild(createRow(details.sheenCode, details.sheenColor));
        if (settings.showKS && details.ksCode) container.appendChild(createRow(`KS: ${details.ksCode}`, '#ccc'));
        if (settings.showIngredients && !forceNoIngredients) {
            details.ingredients.forEach(ing => {
                const s = getDisplaySettings(ing.name);
                container.appendChild(createRow(`${ing.count} x ${s.initials}`, s.color));
            });
        }
        item.appendChild(container);
    }

    // =========================================================================
    // REFRESH LOGIC (Fixed "Initializing" Hang)
    // =========================================================================
    function updateInvSummaryUI() {
        if (!settings.showSummary) return;
        let html = '<div style="color: #fff; font-weight: bold; border-bottom: 1px solid #555; margin-bottom: 5px; padding-bottom: 2px; font-size:10px;">MISSING PARTS</div>';
        let hasMissing = false;
        Object.keys(NEEDED_PARTS).sort().forEach(name => {
            let missing = NEEDED_PARTS[name] - (OWNED_PARTS[name] || 0);
            if (missing > 0) {
                hasMissing = true; let s = getDisplaySettings(name);
                html += `<div style="display: flex; justify-content: space-between; gap: 10px; font-size: 11px; line-height: 14px;"><span style="color: ${s.color}; text-shadow: 1px 1px 0 #000;">${s.text}</span><span style="color: #fff; font-weight: bold;">${missing}</span></div>`;
            }
        });
        document.getElementById('fab_summary_list').innerHTML = hasMissing ? html : '<div style="color:#888; font-size:10px;">Complete!</div>';
    }

    function updateTradeSummaryUI() {
        if (!settings.showSummary) return;
        let htmlRows = '';
        let missingCount = 0;
        Object.keys(GLOBAL_TRADE_NEEDED).sort().forEach(name => {
            const net = GLOBAL_TRADE_NEEDED[name] - (GLOBAL_TRADE_OWNED[name] || 0);
            if (net > 0) {
                missingCount++; const s = getDisplaySettings(name);
                htmlRows += `<div style="display: flex; justify-content: space-between; gap: 10px; font-size: 11px; line-height: 14px;"><span style="color: ${s.color}; text-shadow: 1px 1px 0 #000;">${s.text}</span><span style="color: #fff; font-weight: bold;">${net}</span></div>`;
            }
        });
        document.getElementById('fab_summary_list').innerHTML = missingCount === 0 ? '<div style="color:#888; font-size:10px;">Complete!</div>' : '<div style="color: #fff; font-weight: bold; border-bottom: 1px solid #555; margin-bottom: 5px; padding-bottom: 2px; font-size:10px;">MISSING PARTS</div>' + htmlRows;
    }

    // =========================================================================
    // PAGE MODES
    // =========================================================================
    if (isMarketPage) {
        const scanMarket = () => {
            const listings = document.querySelectorAll('.market_listing_row');
            const assets = win.g_rgAssets;
            if (!assets || !assets[440] || !assets[440][2]) return;
            listings.forEach(row => {
                if (row.getAttribute('data-fab-market-done')) return;
                const buyBtn = row.querySelector('.item_market_action_button'); if (!buyBtn) return;
                const match = buyBtn.href.match(/'(\d+)',\s*440,\s*'2',\s*'(\d+)'/); if (!match) return;
                const assetId = match[2]; const itemData = assets[440][2][assetId];
                if (itemData && itemData.descriptions) {
                    const details = parseItemDetails(itemData.descriptions);
                    const imgContainer = row.querySelector('.market_listing_item_img_container');
                    if (imgContainer) { renderFabOverlay(imgContainer, details, true); row.setAttribute('data-fab-market-done', 'true'); }
                }
            });
        };
        document.getElementById('fab_summary_list').innerHTML = '<div style="color:#888; font-size:10px;">Market Mode Active</div>';
        setInterval(scanMarket, 1000);
    } else if (isTradePage) {
        const scanTrade = () => {
            GLOBAL_TRADE_NEEDED = {}; GLOBAL_TRADE_OWNED = {}; let fabricatorFound = false;
            document.querySelectorAll('.item').forEach(item => {
                let data = item.rgItem; if (!data) return;
                const rawName = data.market_hash_name || "";
                if (rawName.includes('Fabricator') || rawName.includes('Kit')) {
                    fabricatorFound = true;
                    if (!item.getAttribute('data-fab-trade-done')) {
                        let details = parseItemDetails(data.descriptions); item.fabCachedIngredients = details.ingredients;
                        renderFabOverlay(item, details); item.setAttribute('data-fab-trade-done', 'true');
                    }
                    if (item.fabCachedIngredients) { item.fabCachedIngredients.forEach(ing => { GLOBAL_TRADE_NEEDED[ing.name] = (GLOBAL_TRADE_NEEDED[ing.name] || 0) + ing.count; }); }
                } else { GLOBAL_TRADE_OWNED[rawName] = (GLOBAL_TRADE_OWNED[rawName] || 0) + (parseInt(data.amount) || 1); }
            });
            if (!fabricatorFound) { mainContainer.style.display = 'none'; return; }
            mainContainer.style.display = 'block'; updateTradeSummaryUI();
        };
        setInterval(scanTrade, 1000);
    } else {
        const loadInventory = async () => {
            try {
                let url = window.location.href.split('/inventory')[0] + '/inventory/json/440/2?l=english&count=5000';
                const response = await fetch(url); const json = await response.json();
                if (!json.success) return;
                const rawItems = json.assets || json.rgInventory;
                const rawDescs = json.descriptions || json.rgDescriptions || [];
                const descMap = {};
                if (Array.isArray(rawDescs)) { rawDescs.forEach(d => { descMap[d.classid + '_' + d.instanceid] = d; }); }
                else { Object.assign(descMap, rawDescs); }
                const items = Array.isArray(rawItems) ? rawItems : Object.values(rawItems);
                items.forEach(item => {
                    let desc = descMap[item.classid + '_' + item.instanceid]; if (!desc) return;
                    let rawName = desc.market_hash_name || "";
                    if (rawName.includes('Fabricator') || rawName.includes('Kit')) {
                        let details = parseItemDetails(desc.descriptions); INVENTORY_DATA[item.id || item.assetid] = details;
                        details.ingredients.forEach(ing => { NEEDED_PARTS[ing.name] = (NEEDED_PARTS[ing.name] || 0) + ing.count; });
                    } else { OWNED_PARTS[rawName] = (OWNED_PARTS[rawName] || 0) + 1; }
                });
                updateInvSummaryUI();
                const observer = new MutationObserver(() => {
                    document.querySelectorAll('.item').forEach(el => {
                        if (el.getAttribute('data-fab-inv-done') || !el.id) return;
                        let parts = el.id.split('_'); if (parts[0].startsWith('item')) parts[0] = parts[0].replace('item', '');
                        if (parts.length < 3) return; let assetId = parts[2];
                        if (INVENTORY_DATA[assetId]) { renderFabOverlay(el, INVENTORY_DATA[assetId]); el.setAttribute('data-fab-inv-done', 'true'); }
                    });
                });
                observer.observe(document.body, { childList: true, subtree: true });
            } catch (e) { console.error(e); }
        };
        loadInventory();
    }
})();