// ============================================================
// unblurHero
// Replaces library_hero_blur.jpg with library_hero.jpg on
// the game detail page so the hero image is sharp.
// ============================================================
(function unblurHero() {
  const observer = new MutationObserver(() => {
    const img = document.querySelector('img[src*="library_hero_blur.jpg"]');
    if (img) {
      img.src = img.src.replace('library_hero_blur.jpg', 'library_hero.jpg');
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

// ============================================================
// recent_games_merge
// Merges recently played games from a source shelf into the
// Recent Games shelf, filling it out beyond the default 11 items.
// ============================================================
const CONFIG = {
  SOURCE_SHELF_LABEL: 'Recently Played',
  TARGET_SHELF_LABEL: 'Recent Games',
  MAX_TOTAL_ITEMS:    25,
  EXPAND_WAIT:      2000,
  POLL_INTERVAL:      80,
  DEBUG:           false,
};

const SC = {
  SHELF_CONTAINER:   '_2tC_c87MH67xQM7Y0pVyXm',
  SHELF_LABEL:       'DialogDropDown_CurrentDisplay',
  EXPAND_BUTTON:     '_3sz4Ldugm_cV_JaHOErVR8',
  LIST_ITEM:         '_1esfEVxhqNfh8fzr_kEGKa',
  LIST_ITEM_SPACER:  '_33gR3fahL5J0_5r8o8YyOi',
  CARD_SIZE_WRAPPER: '_2XftMcBO9aY7VXCivzuW7-',
  GAME_NODE:         '_1pwP4eeP1zQD7PEgmsep0W',
  GAME_NODE_GRID:    'NSf2V4yY_wxn7AE6DWDYN',
  LINK_GRID:         '_3ANruIVwRSgaU7L1eWRnf8',
  LINK_LIST:         'biTV-8rS2M65imVHU15Nv',
  DATE_BADGE:        '_1LJqx_qFOC8199RBQO5kU8',
};

(function () {
  'use strict';

  const log = CONFIG.DEBUG ? console.log.bind(console, '[merge]') : () => {};

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

  function getTitleFromListItem(listItem) {
    const nameDiv = listItem.querySelector('div[id][style*="display: none"]');
    return nameDiv?.textContent.trim() || null;
  }

  function getTitleFromGridCell(cell) {
    const nameDiv = cell.querySelector('div[id][style*="display: none"]');
    return nameDiv?.textContent.trim() || null;
  }

  function getSourceCells(shelf) {
    const grid = shelf.querySelector('[role="grid"]');
    if (!grid) return [];
    return Array.from(grid.querySelectorAll('[role="gridcell"]'))
      .filter(cell => cell.querySelector('.' + SC.GAME_NODE));
  }

  function buildListItem(cell) {
    const gameNode = cell.querySelector('.' + SC.GAME_NODE);
    if (!gameNode) return null;

    gameNode.classList.remove(SC.GAME_NODE_GRID);

    const linkDiv = gameNode.querySelector('.WYgDg9NyCcMIVuMyZ_NBC');
    if (linkDiv) {
      linkDiv.classList.remove(SC.LINK_GRID);
      linkDiv.classList.add(SC.LINK_LIST);
    }

    const dateBadge = gameNode.querySelector('.' + SC.DATE_BADGE);
    if (dateBadge) dateBadge.style.display = 'none';

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

    sizeDiv.appendChild(gameNode);
    listItem.appendChild(sizeDiv);

    return listItem;
  }

  function hideSourceShelf(shelf) {
    const container = shelf.closest('.' + SC.SHELF_CONTAINER);
    if (container) {
      container.style.height = '1px';
      container.style.overflow = 'hidden';
      container.style.minHeight = '0';
    }
    log('source shelf shrunk');
  }

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

    const currentCount = listItems.length;
    const toAppend = Math.max(0, CONFIG.MAX_TOTAL_ITEMS - currentCount);

    if (toAppend === 0) {
      log('shelf already has', currentCount, 'items, nothing to append');
      hideSourceShelf(sourceShelf);
      return;
    }

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

  function expandAndMerge(recentList, sourceShelf) {
    if (recentList.dataset.mergePatching === '1') return;
    if (recentList.dataset.mergeDone === '1') return;
    recentList.dataset.mergePatching = '1';

    const shelfContainer = sourceShelf.closest('.' + SC.SHELF_CONTAINER);
    if (shelfContainer) shelfContainer.style.display = '';

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

  let lastKnownList = null;

  function run() {
    const recentList  = findRecentGamesList();
    const sourceShelf = findSourceShelf();

    if (!recentList || !sourceShelf) return;

    if (lastKnownList && lastKnownList !== recentList) {
      log('navigation detected — new list element, resetting');
    }
    lastKnownList = recentList;

    if (recentList.dataset.mergeDone === '1') return;

    expandAndMerge(recentList, sourceShelf);
  }

  const observer = new MutationObserver(() => {
    clearTimeout(observer._t);
    observer._t = setTimeout(run, 250);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  let initAttempts = 0;
  const initTimer = setInterval(() => {
    if (++initAttempts > 20) { clearInterval(initTimer); return; }
    if (findRecentGamesList() && findSourceShelf()) {
      clearInterval(initTimer);
      run();
    }
  }, 500);

})();