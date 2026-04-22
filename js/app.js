const { createApp, ref, computed, watch, onMounted, nextTick } = Vue;

const app = createApp({
  setup() {
    const rawInput = ref("");
    const items = ref([]);
    const mapping = ref({ x: "", yKeys: [] });
    const config = ref({ title: "Mon Graphique", source: "", type: "line" });
    const isTextSelected = ref(false);
    const applyToSerie = ref(false);
    const fileInput = ref(null);

    // --- SYSTÈME D'ANNULATION (UNDO) ---
    const history = ref([]);
    const isUndoing = ref(false);

    const saveState = () => {
      if (isUndoing.value || items.value.length === 0) return;
      const state = JSON.stringify({
        styles: { ...ChartModule.persistentStyles },
        config: { ...config.value },
        mapping: { ...mapping.value },
        items: JSON.parse(JSON.stringify(items.value)), // Sauvegarde les valeurs éditées
        legendPos: { ...ChartModule.legendPos },
      });

      if (
        history.value.length === 0 ||
        history.value[history.value.length - 1] !== state
      ) {
        history.value.push(state);
        if (history.value.length > 50) history.value.shift();
      }
    };

    const undo = () => {
      if (history.value.length <= 1) return;
      isUndoing.value = true;
      history.value.pop();
      const prevState = JSON.parse(history.value[history.value.length - 1]);

      ChartModule.persistentStyles = prevState.styles || {};
      ChartModule.legendPos = prevState.legendPos || { x: null, y: null };
      config.value = prevState.config;
      mapping.value = prevState.mapping;
      items.value = prevState.items; // Restaure les points

      nextTick(() => {
        isUndoing.value = false;
      });
    };

    // --- ACTIONS ---
    const actions = {
      setSize: (size, all) => {
        saveState();
        ChartModule.setFontSize(size, all);
      },
      bold: (all) => {
        saveState();
        ChartModule.toggleBold(all);
      },
      italic: (all) => {
        saveState();
        ChartModule.toggleItalic(all);
      },
      setBg: (color, all) => {
        saveState();
        ChartModule.setBgColor(color, all);
      },
      outline: (all) => {
        saveState();
        ChartModule.toggleOutline(all);
      },
      delete: () => {
        saveState();
        ChartModule.deleteText();
      },
      undo: () => undo(),
    };

    // --- PARSING (RAZ de l'historique ici) ---
    const parseData = (val) => {
      if (!val || !val.trim()) {
        items.value = [];
        history.value = [];
        return;
      }

      const rows = val.trim().split("\n");
      const heads = rows[0].split("\t").map((h) => h.trim());

      items.value = rows.slice(1).map((row) => {
        const cols = row.split("\t");
        return heads.reduce((acc, h, i) => {
          const v = cols[i]?.trim().replace(",", ".");
          acc[h] = v === "" || isNaN(v) ? v : parseFloat(v);
          return acc;
        }, {});
      });

      if (heads.length > 0) {
        mapping.value.x = heads[0];
        mapping.value.yKeys = heads.slice(1);
      }

      // RESET DE L'HISTORIQUE au collage
      history.value = [];
      ChartModule.persistentStyles = {};

      nextTick(() => {
        saveState(); // Premier état = le collage
        ChartModule.render(
          "#chart-container",
          items.value,
          mapping.value,
          config.value,
        );
      });
    };

    watch(rawInput, (newVal) => parseData(newVal));

    watch(
      [items, mapping, config],
      () => {
        if (items.value?.length && mapping.value.yKeys?.length) {
          if (!isUndoing.value) saveState();
          ChartModule.render(
            "#chart-container",
            items.value,
            mapping.value,
            config.value,
          );
        }
      },
      { deep: true },
    );

    return {
      rawInput,
      items,
      mapping,
      config,
      isTextSelected,
      applyToSerie,
      actions,
      history,
      fileInput,
      headers: computed(() =>
        items.value && items.value.length ? Object.keys(items.value[0]) : [],
      ),
      moveItem: (index, dir) => {
        const newIdx = index + dir;
        if (newIdx < 0 || newIdx >= items.value.length) return;
        const res = items.value.splice(index, 1)[0];
        items.value.splice(newIdx, 0, res);
      },
      removeItem: (index) => {
        items.value.splice(index, 1);
      },
      onTextSelected: (s) => {
        isTextSelected.value = s;
      },
      triggerOpenFile: () => fileInput.value.click(),
      openProject: (e) => {
        /* ... (votre code open) */
      },
      saveProject: () => {
        /* ... (votre code save) */
      },
    };
  },
});

const vm = app.mount("#app");
window.appInstance = vm;
