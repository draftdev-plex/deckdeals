import { ServerAPI, findModuleChild } from "decky-frontend-lib"
import { CACHE } from "../utils/Cache"
import { priceService } from "../service/PriceService"
import { SETTINGS, Setting } from "../utils/Settings"
import { t } from "../l10n"

type Tab = {
    description: string
    devtoolsFrontendUrl: string
    id: string
    title: string
    type: 'page'
    url: string
    webSocketDebuggerUrl: string
}

type Info = {
    hash: string
    key: string
    pathname: string
    search: string
    state: { force: number; url: string }
}

const History: {
    listen: (callback: (info: Info) => void) => () => void;
    location?: Info;
} = findModuleChild((m) => {
    if (typeof m !== 'object') return undefined
    for (const prop in m) {
        if (m[prop]?.m_history) return m[prop].m_history
    }
})

export const injectStore = (serverApi: ServerAPI) => {
    let isStoreMounted = false;
    if (!History || !History.listen) {
        return () => { CACHE.setValue(CACHE.APP_ID_KEY, ""); };
    }

    let storeWebSocket: WebSocket | null = null;
    let retryTimer: NodeJS.Timeout | null = null;
    let wsMessageId = 10; // Counter for WebSocket command IDs

    // Update the button with price info


    // Inject the Deckdeals box (was SteamDB box)
    const injectDeckDealsBox = async (appId: string) => {
        if (!storeWebSocket || storeWebSocket.readyState !== WebSocket.OPEN) return;

        const historyRange = await SETTINGS.load(Setting.HISTORY_RANGE) || "1y";
        const historyRangeText = t("settings.historyRange." + historyRange);
        const steamDBUrl = `https://steamdb.info/app/${appId}/`;
        const settingsPadding = SETTINGS.defaults.paddingBottom;

        // Load setting for Quick Links to prevent flash
        const showQuickLinks = await SETTINGS.load(Setting.SHOW_QUICK_LINKS);
        // Default to true if undefined
        const showQuickLinksBool = showQuickLinks !== undefined ? showQuickLinks : true;
        const displayStyle = showQuickLinksBool ? 'flex' : 'none';

        // We inject a script that runs in the context of the store page (Steam browser)
        const js = `
            (function() {
                var appId = "${appId}";
                var boxId = 'dbpc-deckdeals-box-' + appId;
                
                // Remove existing if any (re-injection safely)
                var existing = document.getElementById(boxId);
                if (existing) existing.remove();
                
                // For legacy/single store page, we used 'dbpc-steamdb-box' without ID. 
                // We should clean that up if we are on store page to avoid duplicates when navigating.
                var oldLegacy = document.getElementById('dbpc-steamdb-box');
                if (oldLegacy) oldLegacy.remove();

                var wrapperDiv = document.createElement('div');
                wrapperDiv.id = boxId;
                wrapperDiv.className = 'game_area_purchase_game_wrapper';
                // Scoped class for easier cleanup if needed
                wrapperDiv.classList.add('deckdeals-injected-module'); 

                wrapperDiv.style.marginTop = '20px';
                wrapperDiv.style.marginBottom = '${settingsPadding}px'; 

                
                 // Close button logic for modal
                 var closeBtnHtml = '';

                wrapperDiv.innerHTML = \`
                    <div class="game_area_purchase_game" style="background: #3b5a7280; padding: 16px; border-radius: 4px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h2 class="title" style="color: #fff; font-size: 18px; margin: 0;">${t("store.title")}</h2>

                        </div>
                        
                        <div class="Deckdeals-info" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                            <!-- Row 1, Col 1: Current Price -->
                            <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                <div style="font-size: 10px; color: #8f98a0; margin-bottom: 2px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">${t("store.currentPrice")}</div>
                                <div style="font-size: 15px; color: #fff; font-weight: bold; margin-bottom: 0px;">
                                    <span id="dd-current-\` + appId + \`">${t("store.loading")}</span>
                                </div>
                                <div id="dd-current-store-\` + appId + \`" style="font-size: 11px; color: #67c1f5; text-align: center;">
                                    <!-- Store -->
                                </div>
                            </div>

                            <!-- Row 1, Col 2: Lowest Price -->
                            <div style="background: rgba(0,0,0,0.2); padding: 10px; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                                <div style="font-size: 10px; color: #8f98a0; margin-bottom: 2px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px;">${t("store.lowestPrice")}</div>
                                <div style="font-size: 15px; color: #fff; font-weight: bold; margin-bottom: 0px;">
                                    <span id="dd-lowest-\` + appId + \`">${t("store.loading")}</span>
                                </div>
                                <div id="dd-lowest-date-\` + appId + \`" style="font-size: 11px; color: #8f98a0; text-align: center;">
                                    <!-- Date - Store -->
                                </div>
                            </div>
                            
                            <!-- Row 2: Prediction (Full Width) -->
                            <div id="dd-prediction-\` + appId + \`" style="grid-column: 1 / -1; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 4px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #67c1f5; display: none;">
                                <!-- Prediction content injected here -->
                            </div>
                        </div>

                        <!-- Graph Container -->
                        <div id="Deckdeals-content-\` + appId + \`" style="background: rgba(0, 0, 0, 0.2); padding: 10px; border-radius: 2px; margin-bottom: 10px;">
                            <div class="Deckdeals-graph-container" style="position: relative; height: 60px; width: 100%; margin: 0 0 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);">
                                <div id="dd-graph-\` + appId + \`" style="width: 100%; height: 100%; display: flex; align-items: flex-end;">
                                    <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #666; font-size: 12px;">${t("store.loadingGraph")}</div>
                                </div>
                                <!-- Overlay for dots -->
                                <div id="dd-graph-overlay-\` + appId + \`" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;"></div>
                            </div>

                             <!-- Dedicated Hover Info -->
                            <div id="dd-hover-info-\` + appId + \`" style="height: 20px; font-size: 12px; color: #8f98a0; text-align: center; opacity: 1; transition: opacity 0.2s;">
                                ${t("store.graphHoverPrompt")}
                            </div>
                            
                            <!-- Disclaimer -->
                            <div style="font-size: 10px; color: #fff; opacity: 0.7; text-align: center; margin-top: 4px;">
                                ${t("store.historyDisclaimer").replace("{period}", historyRangeText)}
                            </div>
                        </div>
                        
                        <div class="Deckdeals-actions" id="dd-actions-\` + appId + \`" style="display: ${displayStyle}; gap: 10px;">
                            <a class="btn_blue_steamui btn_medium" href="${steamDBUrl}" target="_blank" style="padding: 6px 12px; font-size: 13px; flex: 1; text-align: center; text-decoration: none; color: white; border-radius: 2px;">
                                <span>SteamDB</span>
                            </a>
                            <a class="btn_blue_steamui btn_medium" href="#" id="dd-itad-link-\` + appId + \`" target="_blank" style="padding: 6px 12px; font-size: 13px; flex: 1; text-align: center; text-decoration: none; color: white; border-radius: 2px;">
                                <span>IsThereAnyDeal</span>
                            </a>
                        </div>
                    </div>
                \`;

                // Inject into Store Page (Standard)
                var purchaseArea = document.querySelector('.game_area_purchase');
                if (purchaseArea) {
                    purchaseArea.parentNode.insertBefore(wrapperDiv, purchaseArea);
                } else {
                    var areaParams = document.querySelector('.game_area_description');
                    if (areaParams) {
                        areaParams.parentNode.insertBefore(wrapperDiv, areaParams);
                    }
                }
            })();
        `;

        storeWebSocket.send(JSON.stringify({
            id: ++wsMessageId,
            method: "Runtime.evaluate",
            params: { expression: js }
        }));
    };

    // Helper to update the box with price data
    const updateDeckDealsBox = async (result: { data: any, error?: string, debug?: any } | null, appId: string) => {
        if (!storeWebSocket || storeWebSocket.readyState !== WebSocket.OPEN) {
            return;
        }

        // Handle null result wrapper
        const data = result ? result.data : null;
        const error = result ? result.error : "Unknown error";

        const dataJson = JSON.stringify(data);
        const errorJson = JSON.stringify(error);
        const dateFormat = await SETTINGS.load(Setting.DATE_FORMAT) || "default";
        const showQuickLinks = await SETTINGS.load(Setting.SHOW_QUICK_LINKS);
        // Default to true if undefined
        const showQuickLinksBool = showQuickLinks !== undefined ? showQuickLinks : true;
        const historyRange = await SETTINGS.load(Setting.HISTORY_RANGE) || "1y";

        const js = `
            (function() {
                try {
                var data = ${dataJson};
                var error = ${errorJson};
                var error = ${errorJson};
                var dateFormat = "${dateFormat}";
                var showQuickLinks = ${showQuickLinksBool};
                var historyRange = "${historyRange}";
                var appId = "${appId}";
                
                var currentEl = document.getElementById('dd-current-' + appId);
                var currentStoreEl = document.getElementById('dd-current-store-' + appId);
                var lowestEl = document.getElementById('dd-lowest-' + appId);
                var lowestDateEl = document.getElementById('dd-lowest-date-' + appId);
                var diffEl = document.getElementById('dd-diff-' + appId);
                var graphEl = document.getElementById('dd-graph-' + appId);
                var overlayEl = document.getElementById('dd-graph-overlay-' + appId);
                var hoverInfoEl = document.getElementById('dd-hover-info-' + appId);
                var actionsEl = document.getElementById('dd-actions-' + appId);
                var predictionEl = document.getElementById('dd-prediction-' + appId);
                var itadLink = document.getElementById('dd-itad-link-' + appId);
                
                // Force Update Styles (Fix for stale DOM)
                var infoBox1 = document.querySelector('#dbpc-deckdeals-box-' + appId + ' .Deckdeals-info > div:nth-child(1)');
                var infoBox2 = document.querySelector('#dbpc-deckdeals-box-' + appId + ' .Deckdeals-info > div:nth-child(2)');
                
                var applyBadgeStyle = function(el) {
                    if (!el) return;
                    el.style.background = 'rgba(0,0,0,0.2)';
                    el.style.padding = '8px 12px';
                    el.style.borderRadius = '6px';
                    el.style.display = 'flex';
                    el.style.flexDirection = 'column';
                    el.style.alignItems = 'center';
                    el.style.justifyContent = 'center';
                    el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
                };

                applyBadgeStyle(infoBox1);
                applyBadgeStyle(infoBox2);
                
                var formatDate = function(dateStr) {
                    try {
                        var d = new Date(dateStr);
                        if (isNaN(d.getTime())) return dateStr;
                        
                        if (dateFormat === 'US') {
                            var day = d.getDate().toString().padStart(2, '0');
                            var month = (d.getMonth() + 1).toString().padStart(2, '0');
                            var year = d.getFullYear();
                            return month + '/' + day + '/' + year;
                        }
                        if (dateFormat === 'EU') {
                            var day = d.getDate().toString().padStart(2, '0');
                            var month = (d.getMonth() + 1).toString().padStart(2, '0');
                            var year = d.getFullYear();
                            return day + '/' + month + '/' + year;
                        }
                        if (dateFormat === 'ISO') {
                             var day = d.getDate().toString().padStart(2, '0');
                            var month = (d.getMonth() + 1).toString().padStart(2, '0');
                            var year = d.getFullYear();
                            return year + '-' + month + '-' + day;
                        }
                        
                        return d.toLocaleDateString();
                    } catch (e) { return dateStr; }
                };

                if (!data) {
                    if (currentEl) currentEl.textContent = "${t("store.dataUnavailable")}";
                    if (lowestEl) lowestEl.textContent = "${t("store.dataUnavailable")}";
                    if (diffEl) diffEl.textContent = "";
                    if (graphEl) graphEl.innerHTML = '<div style="width:100%; text-align:center; color:#666;">' + (error || "${t("store.noData")}") + '</div>';
                    return;
                }

                // --- DATA FILTERING START ---
                // Filter history based on settings
                var startDate = new Date();
                
                if (historyRange === '3m') {
                    startDate.setMonth(startDate.getMonth() - 3);
                } else if (historyRange === '6m') {
                    startDate.setMonth(startDate.getMonth() - 6);
                } else if (historyRange === '2y') {
                    startDate.setFullYear(startDate.getFullYear() - 2);
                } else {
                    // Default 1y
                    startDate.setFullYear(startDate.getFullYear() - 1);
                }
                var startTime = startDate.getTime();

                var fullHistory = data.history || [];
                var filteredHistory = fullHistory.filter(function(entry) {
                    return new Date(entry.date).getTime() >= startTime;
                });
                
                // Recalculate Lowest for the filtered period
                var lowestInYear = null;
                var lowestPriceInYear = Infinity;

                filteredHistory.forEach(function(p) {
                    if (p.amount < lowestPriceInYear) {
                        lowestPriceInYear = p.amount;
                        lowestInYear = p;
                    }
                });
                
                var displayLowest = lowestInYear ? {
                    amount: lowestPriceInYear,
                    currency: data.lowest.currency, // Currency assumed constant
                    date: lowestInYear.date,
                    store: lowestInYear.store
                } : null;
                
                // 1. Update Current Price and Lowest Price Info (Moved up)
                var currentAmount = 0;
                var currentStore = "Steam"; // Default
                
                if (fullHistory.length > 0) {
                    var latestEntry = fullHistory[fullHistory.length - 1];
                    currentAmount = latestEntry.amount;
                    if (latestEntry.store) currentStore = latestEntry.store;
                }
                // --- DATA FILTERING END ---

                // --- PREDICTION LOGIC START ---
                var predictNextSale = function(history, currentPrice) {
                    if (!history || history.length < 10) return null; // Need enough data

                    // 1. Find meaningful price drops (sales)
                    // A sale is defined as a price significantly lower than the *previous* price
                    // or lower than a moving average. Simple approach: lower than previous.
                    var sales = [];
                    for (var i = 1; i < history.length; i++) {
                        var curr = history[i];
                        var prev = history[i-1];
                        // If price dropped by at least 10%
                        if (curr.amount < prev.amount * 0.9) {
                            sales.push(curr);
                        }
                    }

                    if (sales.length === 0) return null;

                    // 2. Identify potential upcoming sales based on Day of Year
                    var now = new Date();
                    var currentYear = now.getFullYear();
                    // Day of Year helper
                    var getDayOfYear = function(date) {
                        var start = new Date(date.getFullYear(), 0, 0);
                        var diff = (date - start) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
                        return Math.floor(diff / (1000 * 60 * 60 * 24));
                    };

                    var todayDOY = getDayOfYear(now);
                    var lookaheadDays = 60; // Look for sales in the next 2 months

                    // Group sales by specific events (Calendar dates)
                    // We look for sales that happened in previous years within [today, today + 60] window
                    var candidates = [];

                    sales.forEach(function(sale) {
                        var saleDate = new Date(sale.date);
                        var saleDOY = getDayOfYear(saleDate);

                        // Handle year wrap-around logic roughly? 
                        // Simplified: just look ahead in same year cycle.
                        // If saleDOY is > todayDOY and saleDOY < todayDOY + lookaheadDays
                        // It's a candidate "recurring" sale.
                        
                        var diff = saleDOY - todayDOY;
                        // Handle wrap around for end of year (e.g. today is Dec 1, look for Jan 1 sales)
                        if (diff < 0) diff += 365;

                        if (diff > 0 && diff <= lookaheadDays) {
                            candidates.push({
                                originalDate: saleDate,
                                amount: sale.amount,
                                diff: diff,
                                doy: saleDOY
                            });
                        }
                    });

                    if (candidates.length === 0) return null;

                    // 3. Cluster candidates
                    // If we have sales from multiple *different* years around the same time, strong signal.
                    // Sort by DOY diff
                    candidates.sort(function(a, b) { return a.diff - b.diff; });

                    // Find a cluster: e.g. at least 2 sales within 7 days of each other in DOY terms
                    // But from different years!
                    var clusters = [];
                    var currentCluster = [candidates[0]];
                    
                    for (var i = 1; i < candidates.length; i++) {
                        var c = candidates[i];
                        var prev = currentCluster[currentCluster.length - 1];
                        
                        // If within 10 days
                        if (Math.abs(c.diff - prev.diff) <= 10) {
                            currentCluster.push(c);
                        } else {
                            if (currentCluster.length >= 2) clusters.push(currentCluster);
                            currentCluster = [c];
                        }
                    }
                    if (currentCluster.length >= 2) clusters.push(currentCluster);

                    // Filter clusters to ensure year diversity (e.g. 2021, 2022)
                    var bestCluster = null;
                    for (var i = 0; i < clusters.length; i++) {
                        var cluster = clusters[i];
                        var years = new Set(cluster.map(function(c) { return c.originalDate.getFullYear(); }));
                        if (years.size >= 2) {
                            bestCluster = cluster;
                            break; // Take the earliest substantial cluster
                        }
                    }

                    if (!bestCluster) return null;

                    // EXTRA CHECK: If currently on sale, don't show prediction
                    // A sale is detected if currentPrice is at least 10% lower than the max price in our history snippet
                    var recentMax = 0;
                    history.forEach(function(h) { if (h.amount > recentMax) recentMax = h.amount; });
                    if (currentPrice < recentMax * 0.95) {
                        return null; // Don't show prediction while on sale
                    }

                    // 4. Formulate prediction
                    // Avg date
                    var avgDiff = 0;
                    var minPrice = Infinity;
                    bestCluster.forEach(function(c) { 
                        avgDiff += c.diff;
                        if (c.amount < minPrice) minPrice = c.amount;
                    });
                    avgDiff = Math.floor(avgDiff / bestCluster.length);

                    var predictedDate = new Date();
                    predictedDate.setDate(predictedDate.getDate() + avgDiff);
                    
                    return {
                        date: predictedDate,
                        price: minPrice
                    };
                };

                var prediction = predictNextSale(fullHistory, currentAmount);
                if (prediction && predictionEl) {
                     var pDateStr = formatDate(prediction.date);
                     
                     // Localized text: "Predicted next sale around: {date}"
                     var text = '<div style="font-size: 13px;">' + "${t("store.predictedSaleDateOnly")}"
                        .replace("{date}", '<span style="color:#fff; font-weight:bold;">' + pDateStr + '</span>') + '</div>';
                     
                     // Subtext: "Based on historical sales dates"
                     text += '<div style="font-size: 10px; color: #8f98a0; margin-top: 2px;">' + "${t("store.predictionSubtext")}" + '</div>';

                     predictionEl.innerHTML = text;
                     predictionEl.style.display = 'flex';
                } else if (predictionEl) {
                     predictionEl.style.display = 'none';
                }
                // --- PREDICTION LOGIC END ---

                // 1. Update Current Price and Lowest Price Info - Logic moved up


                // --- FREE GAME HANDLING ---
                if (currentAmount === 0 && fullHistory.length > 0) {
                    // Mute normal elements
                    var contentDiv = document.getElementById('Deckdeals-content-' + appId);
                    var infoDiv = document.querySelector('#dbpc-deckdeals-box-' + appId + ' .Deckdeals-info');
                    
                    if (contentDiv) contentDiv.style.display = 'none';
                    if (infoDiv) {
                         // Reset grid to block for simple message
                         infoDiv.style.display = 'block';
                         infoDiv.innerHTML = '<div style="font-size: 14px; color: #beee11; font-weight: bold; padding: 5px 0;">${t("store.freeGame")}</div>';
                    }
                    if (predictionEl) predictionEl.style.display = 'none';
                } else {
                    // Update Current Price Text
                    if (currentEl && fullHistory.length > 0) {
                        currentEl.textContent = currentAmount.toFixed(2) + ' ' + data.lowest.currency;
                    }
                    
                    if (currentStoreEl) {
                        currentStoreEl.textContent = currentStore;
                    }
    
                    // Calculate Difference
                    var diffText = '';
                    var diffColor = '#c6d4df';
                    
                    if (currentAmount > 0 && displayLowest) {
                         if (currentAmount > displayLowest.amount + 0.01) {
                                 var diff = currentAmount - displayLowest.amount;
                                 var percent = ((diff / currentAmount) * 100).toFixed(0);
                                 diffText = '-' + percent + '%';
                                 diffColor = '#beee11'; // highlight discount
                            } else if (Math.abs(currentAmount - displayLowest.amount) < 0.01) {
                                 // All year low
                                 diffText = '${t("store.allYearLow")}';
                                 diffColor = '#ff9300';
                            }
                    }

                    // Update Lowest Price Label (Line 0: Label + Diff)
                    // Find the label element for Lowest Price
                    var lowestLabelEl = document.querySelector('#dbpc-deckdeals-box-' + appId + ' .Deckdeals-info > div:nth-child(2) > div:first-child');
                    if (lowestLabelEl) {
                         var labelHtml = '${t("store.lowestPrice")}';
                         if (diffText) {
                             if (diffText === '${t("store.allYearLow")}') {
                                labelHtml += ' <span style="color: ' + diffColor + ';">(' + diffText + ')</span>';
                             } else {
                                labelHtml += ' <span style="color: ' + diffColor + '; font-weight: bold;">(' + diffText + ')</span>';
                             }
                         }
                         lowestLabelEl.innerHTML = labelHtml;
                    }

                    // Update Lowest Price (Line 1: Price only)
                    if (lowestEl) {
                        try {
                            if (displayLowest) {
                                lowestEl.innerHTML = displayLowest.amount.toFixed(2) + ' ' + displayLowest.currency;
                            } else {
                                lowestEl.innerHTML = '<span style="color: #8f98a0;">${t("store.noDataRecent")}</span>';
                            }
                        } catch (e) {}
                    }
                    
                    // Update Lowest Date/Store (Line 2)
                    if (lowestDateEl && displayLowest) {
                        try {
                             var dateStr = formatDate(displayLowest.date);
                             lowestDateEl.innerHTML = dateStr + ' - <span style="color: #67c1f5;">' + displayLowest.store + '</span>';
                        } catch(e) {}
                    }
                }


                // 4. Update GLINKS
                // This is already handled by initial injection style, but if settings change dynamically we keep this
                var buttonContainer = actionsEl; 
                if (buttonContainer) {
                    buttonContainer.style.display = showQuickLinks ? 'flex' : 'none';
                }

                if (itadLink && data.urls) {
                    itadLink.href = data.urls.itad;
                }

                // 4. Generate Graph
                if (graphEl && overlayEl) {
                    if (filteredHistory.length > 1) {
                        graphEl.innerHTML = ''; // Clear loading
                        overlayEl.innerHTML = '';
                        
                        try {
                            var pts = filteredHistory;
                            var prices = pts.map(function(p) { return p.amount; });
                            var minPrice = Math.min.apply(null, prices);
                            var maxPrice = Math.max.apply(null, prices);
                            if (minPrice === maxPrice) maxPrice = minPrice + 1;
                            
                            var minTime = new Date(pts[0].date).getTime();
                            var maxTime = new Date().getTime(); // Now
                            
                            var pointsStr = '';
                            
                            // Generate Stepped Path
                            var firstT = new Date(pts[0].date).getTime();
                            var firstX = (maxTime === minTime) ? 0 : ((firstT - minTime) / (maxTime - minTime)) * 100;
                            var firstRange = maxPrice - minPrice;
                            var firstVal = (pts[0].amount - minPrice) / firstRange;
                            var firstY = 50 - (firstVal * 40) - 5;
                            
                            pointsStr += firstX.toFixed(2) + ',' + firstY.toFixed(2) + ' ';

                            pts.forEach(function(pt, i) {
                                if (i === 0) return; 

                                var t = new Date(pt.date).getTime();
                                var x = ((t - minTime) / (maxTime - minTime)) * 100;
                                
                                var range = maxPrice - minPrice;
                                var val = (pt.amount - minPrice) / range;
                                var y = 50 - (val * 40) - 5;
                                
                                var prevPt = pts[i-1];
                                var prevVal = (prevPt.amount - minPrice) / range;
                                var prevY = 50 - (prevVal * 40) - 5;
                                
                                pointsStr += x.toFixed(2) + ',' + prevY.toFixed(2) + ' ';
                                pointsStr += x.toFixed(2) + ',' + y.toFixed(2) + ' ';
                            });

                            // Extend to "now"
                            var lastPt = pts[pts.length-1];
                            var range = maxPrice - minPrice;
                            var val = (lastPt.amount - minPrice) / range;
                            var lastY = 50 - (val * 40) - 5;
                            pointsStr += '100,' + lastY.toFixed(2);
        
                            var svg = '<svg viewBox="0 0 100 50" preserveAspectRatio="none" style="width: 100%; height: 100%; overflow: visible;" xmlns="http://www.w3.org/2000/svg">';
                            svg += '<polyline vector-effect="non-scaling-stroke" points="' + pointsStr + '" fill="none" stroke="#67c1f5" stroke-width="2" />';
                            svg += '</svg>';
                            
                            graphEl.innerHTML = svg;

                            // Generate Interactive HTML Dots
                             pts.forEach(function(pt, i) {
                                var t = new Date(pt.date).getTime();
                                var x = ((t - minTime) / (maxTime - minTime)) * 100;
                                
                                var range = maxPrice - minPrice;
                                var val = (pt.amount - minPrice) / range;
                                var topPercent = ((50 - (val * 40) - 5) / 50) * 100;
                                
                                var dateStr = formatDate(pt.date);
                                var priceStr = pt.amount.toFixed(2) + ' ' + data.lowest.currency;
                                var storeStr = pt.store || "Steam";

                                var dot = document.createElement('div');
                                dot.style.position = 'absolute';
                                dot.style.left = x + '%';
                                dot.style.top = topPercent + '%';
                                dot.style.width = '6px';
                                dot.style.height = '6px';
                                dot.style.borderRadius = '50%';
                                dot.style.background = 'transparent';
                                dot.style.transform = 'translate(-50%, -50%)';
                                dot.style.cursor = 'pointer';
                                dot.style.pointerEvents = 'auto';
                                dot.style.transition = 'all 0.1s';
                                
                                dot.dataset.price = priceStr;
                                dot.dataset.date = dateStr;
                                dot.dataset.store = storeStr;
                                dot.className = 'dd-graph-dot';

                                overlayEl.appendChild(dot);
                            });

                        } catch(e) {}
                        
                        // Interaction Logic
                        // Interaction Logic
                        var resetGraphState = function() {
                            var allDots = overlayEl.querySelectorAll('.dd-graph-dot');
                            allDots.forEach(function(d) {
                                d.style.backgroundColor = 'transparent';
                                d.style.width = '6px';
                                d.style.height = '6px';
                                d.style.border = 'none';
                                d.style.zIndex = '1';
                            });
                            if (hoverInfoEl) {
                                hoverInfoEl.innerHTML = '${t("store.graphHoverPrompt")}';
                                hoverInfoEl.style.color = '#8f98a0';
                                hoverInfoEl.style.opacity = '1';
                            }
                        };

                         var handleInteraction = function(e) {
                             var target = e.target;
                             if (target && target.classList.contains('dd-graph-dot')) {
                                 // Reset others first
                                 var allDots = overlayEl.querySelectorAll('.dd-graph-dot');
                                 allDots.forEach(function(d) {
                                     d.style.backgroundColor = 'transparent';
                                     d.style.width = '6px';
                                     d.style.height = '6px';
                                     d.style.border = 'none';
                                     d.style.zIndex = '1';
                                 });

                                 target.style.backgroundColor = '#fff';
                                 target.style.width = '10px';
                                 target.style.height = '10px';
                                 target.style.border = '2px solid #67c1f5';
                                 target.style.zIndex = '10'; // Bring to front
                                 
                                 var price = target.dataset.price;
                                 var date = target.dataset.date;
                                 var store = target.dataset.store;
                                 
                                 if (hoverInfoEl) {
                                     hoverInfoEl.innerHTML = '<span style="color: #beee11; font-weight: bold;">' + price + '</span> ${t("store.hoverOn")} <span style="color: #8f98a0;">' + date + ' (' + store + ')</span>';
                                     hoverInfoEl.style.color = '#fff'; // Brighten text
                                     hoverInfoEl.style.opacity = '1';
                                 }
                             } else if (e.type === 'click') {
                                 // Clicked background
                                 resetGraphState();
                             }
                        };
    
                        overlayEl.onmouseover = handleInteraction;
                        overlayEl.onclick = handleInteraction;
                        overlayEl.onmouseleave = resetGraphState;
                    } else {
                        graphEl.innerHTML = '<div style="width:100%; height: 100%; display:flex; align-items:center; justify-content:center; color:#666; font-size:12px;">${t("store.notEnoughHistory")}</div>';
                    }
                }

                } catch(err) {
                    var el = document.getElementById('dd-graph-' + "${appId}");
                    if (el) el.innerHTML = '<div style="width:100%; height: 100%; display:flex; align-items:center; justify-content:center; color:red; font-size:10px; text-align: center;">' + err + '</div>';
                }
            })();
        `;

        storeWebSocket.send(JSON.stringify({
            id: ++wsMessageId,
            method: "Runtime.evaluate",
            params: { expression: js }
        }));
    }

    // Disconnect/teardown helper
    const disconnectStoreDebugger = () => {
        isStoreMounted = false; // Mark as inactive immediately

        if (storeWebSocket) {
            // Remove listeners to prevent any pending messages from firing
            storeWebSocket.onopen = null;
            storeWebSocket.onmessage = null;
            storeWebSocket.onclose = null;
            storeWebSocket.close();
            storeWebSocket = null;
        }
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
        // Force clear the cache
        CACHE.setValue(CACHE.APP_ID_KEY, "");
    };

    const updateAppIdFromUrl = async (url: string) => {
        // Guard: If we've already left the store view, do not update
        if (!isStoreMounted) {
            CACHE.setValue(CACHE.APP_ID_KEY, "");
            return;
        }

        if (!url.includes('https://store.steampowered.com')) {
            CACHE.setValue(CACHE.APP_ID_KEY, "");
            return;
        }



        const appId = url.match(/\/app\/([\d]+)\/?/)?.[1];
        CACHE.setValue(CACHE.APP_ID_KEY, appId ?? "");

        // Inject button into the store page when we have an appId and plugin is enabled
        if (appId) {
            // Check if plugin is enabled
            const enabled = await SETTINGS.load(Setting.ENABLED);
            if (!enabled) {
                return; // Plugin is disabled, don't inject
            }

            // Small delay to let the store page finish rendering
            setTimeout(async () => {
                injectDeckDealsBox(appId);
                const data = await priceService.getLowestPrice(appId);
                // Standard Store Page Update
                updateDeckDealsBox(data ?? null, appId);
            }, 1500);
        }
    };

    const connectToStoreDebugger = async (retries = 3) => {
        // Stop if we navigated away during the async wait
        if (!isStoreMounted) {
            CACHE.setValue(CACHE.APP_ID_KEY, "");
            return;
        }

        try {
            // 1. Fetch the tabs
            const response = await serverApi.fetchNoCors<{ body: string }>('http://localhost:8080/json');
            if (!response.success) {
                if (retries > 0 && isStoreMounted) {
                    retryTimer = setTimeout(() => connectToStoreDebugger(retries - 1), 1000);
                    return;
                }
                CACHE.setValue(CACHE.APP_ID_KEY, "");
                return;
            }

            const tabs: Tab[] = JSON.parse(response.result.body) || [];
            const storeTab = tabs.find((tab) => tab.url.includes('https://store.steampowered.com'));

            // Early return if no store tab / websocket
            if (!storeTab || !storeTab.webSocketDebuggerUrl) {
                if (retries > 0 && isStoreMounted) {
                    retryTimer = setTimeout(() => connectToStoreDebugger(retries - 1), 1000);
                    return;
                }
                CACHE.setValue(CACHE.APP_ID_KEY, "");
                return;
            }

            // 2. Update the appId from the current URL
            updateAppIdFromUrl(storeTab.url);

            // 3. Connect to the websocket debugger to listen for navigation events
            if (storeWebSocket) {
                storeWebSocket.close();
            }
            storeWebSocket = new WebSocket(storeTab.webSocketDebuggerUrl);

            storeWebSocket.onopen = () => {
                if (!isStoreMounted) {
                    storeWebSocket?.close();
                    CACHE.setValue(CACHE.APP_ID_KEY, "");
                    return;
                }
                storeWebSocket?.send(JSON.stringify({ id: 1, method: "Page.enable" }));
            };

            storeWebSocket.onmessage = async (event) => {
                if (!isStoreMounted) {
                    CACHE.setValue(CACHE.APP_ID_KEY, "");
                    return; // Ignore messages if we aren't in the store view
                }

                try {
                    const data = JSON.parse(event.data);

                    // 1. Navigation Event
                    // Only react to top-level frame navigations, not sub-frames (ads, widgets, etc.)
                    if (data.method === "Page.frameNavigated" && data.params?.frame?.url && !data.params?.frame?.parentId) {
                        updateAppIdFromUrl(data.params.frame.url);
                    }

                } catch (e) {
                }
            };

            storeWebSocket.onclose = () => {
                if (isStoreMounted) {
                    CACHE.setValue(CACHE.APP_ID_KEY, "");
                }
            }

        } catch (e) {
            if (retries > 0 && isStoreMounted) {
                retryTimer = setTimeout(() => connectToStoreDebugger(retries - 1), 1000);
                return;
            }
            CACHE.setValue(CACHE.APP_ID_KEY, "");
            return;
        }
    };

    // Central handler for routing state changes
    const handleLocationChange = (pathname: string) => {
        if (pathname === '/steamweb') {
            // Set a small timeout to make sure the store tab url is updated after the navigation,
            // e.g. when going from the library to the store, a game's store page might still be loaded but then steamOS immediately navigates to the front page causing some weird timing issues.
            setTimeout(() => {
                if (!isStoreMounted) {
                    isStoreMounted = true;
                    connectToStoreDebugger();
                }
            }, 1000)

        }
        else {
            if (isStoreMounted) {
                disconnectStoreDebugger();
            }
        }
    };

    // Listen to steamdeck router events, for example, fires when a user navigates from the library screen to the store screen.
    const stopHistoryListener = History.listen((info) => {
        handleLocationChange(info.pathname);
    });


    // Initial Check
    if (History.location) {
        handleLocationChange(History.location.pathname);
    }



    // Return the teardown function
    return () => {

        disconnectStoreDebugger();
        stopHistoryListener();
    };
};