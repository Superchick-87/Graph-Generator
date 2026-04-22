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

    const history = ref([]);
    const isUndoing = ref(false);

    // Capture l'état complet y compris le texte brut exact
    const saveState = () => {
      if (isUndoing.value || items.value.length === 0) return;

      const state = JSON.stringify({
        styles: JSON.parse(JSON.stringify(ChartModule.persistentStyles)),
        config: JSON.parse(JSON.stringify(config.value)),
        mapping: JSON.parse(JSON.stringify(mapping.value)),
        items: JSON.parse(JSON.stringify(items.value)),
        rawInput: rawInput.value, // Sauvegarde le texte brut avec libellés
        legendPos: JSON.parse(JSON.stringify(ChartModule.legendPos)),
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

      // Restauration de tous les objets
      ChartModule.persistentStyles = prevState.styles || {};
      ChartModule.legendPos = prevState.legendPos || { x: null, y: null };
      config.value = prevState.config;
      mapping.value = prevState.mapping;
      items.value = prevState.items;

      // RESTAURATION DU TEXTE BRUT (Évite l'effacement des libellés)
      rawInput.value = prevState.rawInput;

      nextTick(() => {
        ChartModule.render(
          "#chart-container",
          items.value,
          mapping.value,
          config.value,
        );
        window.setTimeout(() => {
          isUndoing.value = false;
        }, 150);
      });
    };

    const parseData = (val) => {
      // On ne parse pas si on est en train d'annuler (car items est déjà restauré)
      if (isUndoing.value || !val || !val.trim()) return;

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

      if (heads.length > 0 && mapping.value.yKeys.length === 0) {
        mapping.value.x = heads[0];
        mapping.value.yKeys = heads.slice(1);
      }

      nextTick(() => {
        ChartModule.render(
          "#chart-container",
          items.value,
          mapping.value,
          config.value,
        );
      });
    };

    watch(rawInput, (newVal) => {
      parseData(newVal);
    });

    // Surveillance des changements manuels dans "Edition des points"
    watch(
      [items, mapping, config],
      () => {
        if (isUndoing.value) return;
        saveState();
        ChartModule.render(
          "#chart-container",
          items.value,
          mapping.value,
          config.value,
        );
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
      history,
      headers: computed(() =>
        items.value.length ? Object.keys(items.value[0]) : [],
      ),
      actions: {
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
      },
      moveItem: (index, dir) => {
        saveState();
        const newIdx = index + dir;
        if (newIdx < 0 || newIdx >= items.value.length) return;
        const res = items.value.splice(index, 1)[0];
        items.value.splice(newIdx, 0, res);
      },
      removeItem: (index) => {
        saveState();
        items.value.splice(index, 1);
      },
      onTextSelected: (s) => {
        isTextSelected.value = s;
      },
      saveState,
      triggerOpenFile: () => fileInput.value.click(),
      fileInput,
    };
  },
});

const vm = app.mount("#app");
window.appInstance = vm;
