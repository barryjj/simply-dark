(function unblurHero() {
    const observer = new MutationObserver(() => {
        // Find the blurred hero image
        const img = document.querySelector('img[src*="library_hero_blur.jpg"]');
        if (img) {
            // Replace the URL with the sharp version
            img.src = img.src.replace('library_hero_blur.jpg', 'library_hero.jpg');
        }
    });

    // Start watching for Steam UI changes
    observer.observe(document.body, { childList: true, subtree: true });
})();




/**
 * recent_games_shelf_fix.js
 * =========================
 * Scales the Recent Games shelf to fill its container width.
 * - Measures the shelf container width at runtime
 * - Calculates portrait card width so all items fill exactly
 * - Caps card size at the #INSTALLED grid's card size
 * - Shows ← → carousel arrows if items overflow
 * - Hero card stays proportional (2.108x portrait width, same height)
 */

/*

(function () {
  'use strict';

  // Ratio constants derived from Steam's hardcoded values
  const HERO_RATIO   = 368.9 / 175;  // 2.108 — hero width relative to portrait
  const HEIGHT_RATIO = 262.5 / 175;  // 1.5   — height relative to portrait width

  function getInstalledCardWidth() {
    // The installed/collection grids use class _3DJLGrqzoQ5vMDI_4VG502
    // and have grid-template-columns: repeat(auto-fill, 222px) inline
    const grids = document.querySelectorAll('._3DJLGrqzoQ5vMDI_4VG502[role="grid"]');
    for (const grid of grids) {
      const colMatch = (grid.style.gridTemplateColumns || '')
        .match(/(\d+(?:\.\d+)?)px\s*\)$/);
      if (colMatch) return parseFloat(colMatch[1]);
    }
    return 222; // hardcoded fallback matching what the HTML shows
  }

  function patchRecentGames() {
    const list = document.querySelector('[role="list"][aria-label="Recent Games"]');
    if (!list || list.dataset.rgPatched === '1') return;

    const items = Array.from(
      list.querySelectorAll('._1esfEVxhqNfh8fzr_kEGKa[role="listitem"]')
    ).filter(item => item.querySelector('._2XftMcBO9aY7VXCivzuW7-'));

    if (!items.length) return;
    list.dataset.rgPatched = '1';

    // Measure available width from the shelf's scroll container
    const scrollContainer = list.parentElement;
    const availableW = scrollContainer
      ? scrollContainer.getBoundingClientRect().width
      : window.innerWidth - 32;

    // Count hero vs portrait items
    const heroCount = items.filter(item =>
      item.querySelector('._3VOR2AeYATx3qSE0I-Pm-5.WYgDg9NyCcMIVuMyZ_NBC')
    ).length;
    const portraitCount = items.length - heroCount;

    // Solve for portrait width:
    // availableW = (heroCount * HERO_RATIO * portraitW) + (portraitCount * portraitW)
    // availableW = portraitW * (heroCount * HERO_RATIO + portraitCount)
    const divisor = (heroCount * HERO_RATIO) + portraitCount;
    let portraitW = availableW / divisor;

    // Cap at installed grid card size so we don't exceed the grid below
    const maxW = getInstalledCardWidth();
    portraitW = Math.min(portraitW, maxW);

    const heroW    = portraitW * HERO_RATIO;
    const cardH    = portraitW * HEIGHT_RATIO;
    const heroImgH = cardH * (172 / 262.5); // image portion of hero card

    // Apply sizes
    items.forEach(item => {
      const sizeDiv = item.querySelector('._2XftMcBO9aY7VXCivzuW7-');
      if (!sizeDiv) return;

      const isHero = !!item.querySelector(
        '._3VOR2AeYATx3qSE0I-Pm-5.WYgDg9NyCcMIVuMyZ_NBC'
      );

      sizeDiv.style.width  = (isHero ? heroW  : portraitW) + 'px';
      sizeDiv.style.height = cardH + 'px';

      if (isHero) {
        const imgContainer = sizeDiv.querySelector(
          '._3VOR2AeYATx3qSE0I-Pm-5._1R9r2OBCxAmtuUVrgBEUBw'
        );
        if (imgContainer) imgContainer.style.height = heroImgH + 'px';
      }
    });

    // Fix outer panel height
    const panel = list.closest('._3fiHsLeD_6rtm6bM9lHlVL');
    if (panel) panel.style.height = cardH + 'px';
  }

  // Re-run on resize so it adapts if Steam window is resized
  window.addEventListener('resize', () => {
    const list = document.querySelector('[role="list"][aria-label="Recent Games"]');
    if (list) {
      delete list.dataset.rgPatched;
      patchRecentGames();
    }
  });

  const observer = new MutationObserver(() => {
    clearTimeout(observer._t);
    observer._t = setTimeout(patchRecentGames, 200);
  });

  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(patchRecentGames, 400);

})();
*/



/**
 * recent_games_merge.js
 * =====================
 * Merges recently played games from a source shelf into the
 * Recent Games shelf, filling it out beyond the default 11 items.
 *
 * How it works:
 *  1. Waits for Recent Games list items to be rendered
 *  2. Expands the source shelf to load all items
 *  3. Finds the splice point — the last item in Recent Games
 *     that also exists in the source shelf (matched by game title)
 *  4. Appends source shelf items after the splice point, wrapped
 *     in native Steam list item structure
 *  5. Hides the source shelf
 *
 * ============================================================
 * USER CONFIGURATION
 * ============================================================
 */
const CONFIG = {
  SOURCE_SHELF_LABEL: 'Recently Played', // Dropdown label of shelf to pull games from
  TARGET_SHELF_LABEL: 'Recent Games',    // Always Recent Games — here for readability
  MAX_TOTAL_ITEMS:    25,                // Target total item count in Recent Games shelf
  EXPAND_WAIT:      2000,                // ms to wait for source shelf expansion
  POLL_INTERVAL:      80,                // ms between expansion polls
  DEBUG:           false,                // Set true to enable console logging
};

/**
 * Steam obfuscated class names.
 * Update these if Valve changes them in a Steam update.
 */
const SC = {
  SHELF_CONTAINER:   '_2tC_c87MH67xQM7Y0pVyXm', // Outer shelf wrapper div
  SHELF_LABEL:       'DialogDropDown_CurrentDisplay', // Shelf title dropdown label
  EXPAND_BUTTON:     '_3sz4Ldugm_cV_JaHOErVR8',  // Expand/collapse arrow button
  LIST_ITEM:         '_1esfEVxhqNfh8fzr_kEGKa',  // Recent Games list item wrapper
  LIST_ITEM_SPACER:  '_33gR3fahL5J0_5r8o8YyOi',  // Spacer div inside non-milestone items
  CARD_SIZE_WRAPPER: '_2XftMcBO9aY7VXCivzuW7-',  // Div that holds inline width/height
  GAME_NODE:         '_1pwP4eeP1zQD7PEgmsep0W',  // Draggable game card node
};

/* ============================================================ */

(function () {
  'use strict';

  const log = CONFIG.DEBUG ? console.log.bind(console, '[merge]') : () => {};

  // ---- Shelf finders ----

  function findRecentGamesList() {
    return document.querySelector('[role="list"][aria-label="Recent Games"]');
  }

  function findSourceShelf() {
    for (const label of document.querySelectorAll('.' + SC.SHELF_LABEL)) {
      if (label.textContent.trim().startsWith(CONFIG.SOURCE_SHELF_LABEL)) {
        let el = label;
        while (el && el !== document.body) {
          if (el.classList.contains(SC.SHELF_CONTAINER)) return el;
          el = el.parentElement;
        }
      }
    }
    return null;
  }

  // ---- Title extraction ----
  // Game name is in a <div id="..."> with display:none inside each item.
  // We specifically target div[id] to avoid matching the file <input> which
  // also has display:none but no id.

  function getTitleFromListItem(listItem) {
    const nameDiv = listItem.querySelector('div[id][style*="display: none"]');
    return nameDiv?.textContent.trim() || null;
  }

  function getTitleFromGridCell(cell) {
    const nameDiv = cell.querySelector('div[id][style*="display: none"]');
    return nameDiv?.textContent.trim() || null;
  }

  // ---- Source shelf cells ----

  function getSourceCells(shelf) {
    const grid = shelf.querySelector('[role="grid"]');
    if (!grid) return [];
    return Array.from(grid.querySelectorAll('[role="gridcell"]'))
      .filter(cell => cell.querySelector('.' + SC.GAME_NODE));
  }

  // ---- Build a native Recent Games list item from a source grid cell ----

  function buildListItem(cell) {
    const gameNode = cell.querySelector('.' + SC.GAME_NODE);
    if (!gameNode) return null;

    const listItem = document.createElement('div');
    listItem.className = SC.LIST_ITEM;
    listItem.setAttribute('role', 'listitem');

    const spacer = document.createElement('div');
    spacer.className = SC.LIST_ITEM_SPACER;
    listItem.appendChild(spacer);

    const sizeDiv = document.createElement('div');
    sizeDiv.className = SC.CARD_SIZE_WRAPPER;
    sizeDiv.style.width  = '175px';
    sizeDiv.style.height = '262.5px';

    sizeDiv.appendChild(gameNode); // MOVE — preserves React handlers + images
    listItem.appendChild(sizeDiv);

    return listItem;
  }

  // ---- Hide source shelf ----

  function hideSourceShelf(shelf) {
    const container = shelf.closest('.' + SC.SHELF_CONTAINER);
    if (container) container.style.display = 'none';
    log('source shelf hidden');
  }

  // ---- Main merge logic ----

  function doMerge(recentList, sourceShelf, sourceCells) {
    if (recentList.dataset.mergeDone === '1') return;
    recentList.dataset.mergeDone = '1';

    const sourceCellsByTitle = new Map();
    sourceCells.forEach(cell => {
      const title = getTitleFromGridCell(cell);
      if (title) sourceCellsByTitle.set(title, cell);
    });

    log('source titles:', [...sourceCellsByTitle.keys()]);

    const listItems = Array.from(
      recentList.querySelectorAll('.' + SC.LIST_ITEM + '[role="listitem"]')
    );

    // How many more items do we need to reach MAX_TOTAL_ITEMS?
    const currentCount = listItems.length;
    const toAppend = Math.max(0, CONFIG.MAX_TOTAL_ITEMS - currentCount);

    if (toAppend === 0) {
      log('shelf already has', currentCount, 'items, nothing to append');
      hideSourceShelf(sourceShelf);
      return;
    }

    // Find splice point — last Recent Games item that also exists in source
    let spliceIndex = -1;
    const titlesInRecent = new Set();

    listItems.forEach((item, i) => {
      const title = getTitleFromListItem(item);
      if (title) {
        titlesInRecent.add(title);
        if (sourceCellsByTitle.has(title)) spliceIndex = i;
      }
    });

    log('titlesInRecent:', [...titlesInRecent]);
    log('spliceIndex:', spliceIndex);

    const splicedTitle = spliceIndex >= 0
      ? getTitleFromListItem(listItems[spliceIndex])
      : null;

    log('splicedTitle:', splicedTitle);

    let pastSplice = splicedTitle === null;
    let appended = 0;

    for (const cell of sourceCells) {
      if (appended >= toAppend) break;

      const title = getTitleFromGridCell(cell);
      if (!title) continue;

      if (!pastSplice) {
        if (title === splicedTitle) pastSplice = true;
        continue;
      }

      if (titlesInRecent.has(title)) {
        log('skipping already-in-recent:', title);
        continue;
      }

      log('appending:', title);
      const newItem = buildListItem(cell);
      if (newItem) {
        recentList.appendChild(newItem);
        appended++;
      }
    }

    log('done, appended:', appended, '— total items:', currentCount + appended);
    hideSourceShelf(sourceShelf);
  }

  // ---- Expand source shelf then merge ----

  function expandAndMerge(recentList, sourceShelf) {
    if (recentList.dataset.mergePatching === '1') return;
    if (recentList.dataset.mergeDone === '1') return;
    recentList.dataset.mergePatching = '1';

    // Ensure source shelf is visible so Steam renders cells during expansion
    const shelfContainer = sourceShelf.closest('.' + SC.SHELF_CONTAINER);
    if (shelfContainer) shelfContainer.style.display = '';

    // Wait until Recent Games list items are actually rendered before proceeding
    const waitDeadline = Date.now() + 5000;
    const waitForItems = setInterval(() => {
      const items = recentList.querySelectorAll('.' + SC.LIST_ITEM + '[role="listitem"]');
      const ready = items.length > 0 && getTitleFromListItem(items[0]) !== null;
      if (!ready && Date.now() < waitDeadline) return;
      clearInterval(waitForItems);

      const initialCells = getSourceCells(sourceShelf);
      const initialCount = initialCells.length;

      if (initialCount > 12) {
        log('source shelf already expanded with', initialCount, 'cells');
        doMerge(recentList, sourceShelf, initialCells);
        return;
      }

      const expandBtn = sourceShelf.querySelector('.' + SC.EXPAND_BUTTON);
      if (!expandBtn) {
        log('no expand button found, merging with', initialCount, 'cells');
        doMerge(recentList, sourceShelf, initialCells);
        return;
      }

      expandBtn.click();
      log('expand clicked, polling for more cells...');

      const deadline = Date.now() + CONFIG.EXPAND_WAIT;
      let lastSeen = initialCount;

      const poll = setInterval(() => {
        const cells = getSourceCells(sourceShelf);
        if (cells.length > lastSeen) lastSeen = cells.length;

        const timedOut = Date.now() >= deadline;
        const settled  = cells.length > initialCount && cells.length === lastSeen;

        if (timedOut || settled) {
          clearInterval(poll);
          log('expansion settled at', cells.length, 'cells');
          doMerge(recentList, sourceShelf,
            cells.length > initialCount ? cells : initialCells);
        }
      }, CONFIG.POLL_INTERVAL);

    }, 100);
  }

  // ---- Navigation detection + cleanup ----
  // When Steam soft-navigates back to the library home, the Recent Games list
  // is re-rendered as a new DOM element. We detect this by watching for the
  // list to disappear and reappear, then reset flags and re-run.

  let lastKnownList = null;

  function run() {
    const recentList  = findRecentGamesList();
    const sourceShelf = findSourceShelf();

    if (!recentList || !sourceShelf) return;

    // Detect navigation: if the list element is different from last time,
    // it's a fresh render — reset everything
    if (lastKnownList && lastKnownList !== recentList) {
      log('navigation detected — new list element, resetting');
      // New element has no flags, so we just proceed
    }
    lastKnownList = recentList;

    if (recentList.dataset.mergeDone === '1') return;

    expandAndMerge(recentList, sourceShelf);
  }

  // MutationObserver — handles both initial load and soft navigation
  const observer = new MutationObserver(() => {
    clearTimeout(observer._t);
    observer._t = setTimeout(run, 250);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Initial retry loop until both shelves are present
  let initAttempts = 0;
  const initTimer = setInterval(() => {
    if (++initAttempts > 20) { clearInterval(initTimer); return; }
    if (findRecentGamesList() && findSourceShelf()) {
      clearInterval(initTimer);
      run();
    }
  }, 500);

})();