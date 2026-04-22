const { createApp, ref, computed, watch, nextTick } = Vue;

const app = createApp({
  setup() {
    const rawInput = ref("");
    const items = ref([]);
    const mapping = ref({ x: "", yKeys: [] });
    const config = ref({
      title: "",
      source: "",
      type: "line",
      showPieLegend: false,
    });
    const isTextSelected = ref(false);
    const applyToSerie = ref(false);
    const fileInput = ref(null);
    const history = ref([]);
    const isUndoing = ref(false);

    const types = [
      {
        id: "line",
        label: "📈 Courbe",
        hint: "1ère colonne = catégories (X), autres = valeurs.",
        ph: "Ex:\nJanvier\t100\t120\nFévrier\t110\t130",
      },
      {
        id: "bar",
        label: "📊 Hist. Vert.",
        hint: "1ère colonne = catégories, autres = valeurs.",
        ph: "Ex:\n2022\t45\t60\n2023\t50\t70",
      },
      {
        id: "horizontalBar",
        label: "📋 Hist. Horiz.",
        hint: "1ère colonne = catégories, autres = valeurs.",
        ph: "Ex:\nFrance\t80\nEspagne\t75",
      },
      {
        id: "pie",
        label: "🍕 Camembert",
        hint: "1ère ligne = noms des parts, 2ème ligne = chiffres.",
        ph: "Ex:\nHommes\tFemmes\tAnimaux\n47\t147\t147",
      },
    ];

    const currentTypeHint = computed(
      () => types.find((t) => t.id === config.value.type).hint,
    );
    const currentPlaceholder = computed(
      () => types.find((t) => t.id === config.value.type).ph,
    );

    const saveState = () => {
      if (isUndoing.value || items.value.length === 0) return;
      const state = JSON.stringify({
        styles: JSON.parse(JSON.stringify(ChartModule.persistentStyles)),
        config: JSON.parse(JSON.stringify(config.value)),
        mapping: JSON.parse(JSON.stringify(mapping.value)),
        items: JSON.parse(JSON.stringify(items.value)),
        rawInput: rawInput.value,
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
      ChartModule.persistentStyles = prevState.styles || {};
      ChartModule.legendPos = prevState.legendPos || { x: null, y: null };
      config.value = prevState.config;
      mapping.value = prevState.mapping;
      items.value = prevState.items;
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
        }, 100);
      });
    };

    const parseData = (val) => {
      if (isUndoing.value || !val || !val.trim()) {
        items.value = [];
        return;
      }
      const rows = val.trim().split("\n");
      const heads = rows[0].split("\t").map((h) => h.trim());
      const newItems = rows.slice(1).map((row) => {
        const cols = row.split("\t");
        return heads.reduce((acc, h, i) => {
          const v = cols[i]?.trim().replace(",", ".");
          acc[h] = v === "" || isNaN(v) ? v : parseFloat(v);
          return acc;
        }, {});
      });

      const oldHeads = items.value.length ? Object.keys(items.value[0]) : [];
      if (JSON.stringify(heads) !== JSON.stringify(oldHeads)) {
        items.value = newItems;
        history.value = [];
        ChartModule.persistentStyles = {};
        ChartModule.legendPos = { x: null, y: null };
        if (config.value.type === "pie") {
          mapping.value.x = null;
          mapping.value.yKeys = heads;
        } else {
          mapping.value.x = heads[0];
          mapping.value.yKeys = heads.slice(1);
        }
      } else {
        items.value = newItems;
      }
    };

    watch(rawInput, (nv) => {
      parseData(nv);
    });
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

    watch(
      () => config.value.type,
      () => {
        ChartModule.deselectText();
        parseData(rawInput.value);
      },
    );

    return {
      rawInput,
      items,
      mapping,
      config,
      types,
      currentTypeHint,
      currentPlaceholder,
      isTextSelected,
      applyToSerie,
      history,
      fileInput,
      headers: computed(() =>
        items.value.length ? Object.keys(items.value[0]) : [],
      ),
      actions: {
        setSize: (s, a) => {
          saveState();
          ChartModule.setFontSize(s, a);
        },
        bold: (a) => {
          saveState();
          ChartModule.toggleBold(a);
        },
        italic: (a) => {
          saveState();
          ChartModule.toggleItalic(a);
        },
        setBg: (c, a) => {
          saveState();
          ChartModule.setBgColor(c, a);
        },
        outline: (a) => {
          saveState();
          ChartModule.toggleOutline(a);
        },
        delete: () => {
          saveState();
          ChartModule.deleteText();
        },
        undo: () => undo(),
      },
      onTextSelected: (s) => {
        isTextSelected.value = s;
      },
      newProject: () => location.reload(),
      triggerOpenFile: () => fileInput.value.click(),
      saveProject: () => {
        const fileName = prompt(
          "Nom du fichier :",
          config.value.title || "sauvegarde",
        );
        if (!fileName) return;
        const data = {
          rawInput: rawInput.value,
          mapping: mapping.value,
          config: config.value,
          items: items.value,
          styles: ChartModule.persistentStyles,
          legendPos: ChartModule.legendPos,
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {
          type: "application/json",
        });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${fileName}.json`;
        link.click();
      },
      openProject: (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target.result);
            isUndoing.value = true;
            ChartModule.persistentStyles = data.styles || {};
            ChartModule.legendPos = data.legendPos || { x: null, y: null };
            config.value = data.config;
            mapping.value = data.mapping;
            rawInput.value = data.rawInput;
            items.value = data.items;
            nextTick(() => {
              ChartModule.render(
                "#chart-container",
                items.value,
                mapping.value,
                config.value,
              );
              window.setTimeout(() => {
                isUndoing.value = false;
                saveState();
              }, 200);
            });
          } catch (err) {
            alert("Erreur.");
          }
        };
        reader.readAsText(file);
      },
      saveState,
    };
  },
});

const vm = app.mount("#app");
window.appInstance = vm;
