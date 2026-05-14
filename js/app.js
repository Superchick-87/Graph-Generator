const { createApp, ref, computed, watch, nextTick } = Vue;

const app = createApp({
  setup() {
    const rawInput = ref("");
    const items = ref([]);
    const mapping = ref({ x: "", yKeys: [] });

    // NOUVEAU : Formats
    const formats = [
      { id: "1x2", label: "1 col x 2 modules", mmW: 48.9, mmH: 75.1 },
      { id: "2x2", label: "2 cols x 2 modules", mmW: 101.8, mmH: 75.1 },
    ];

    const config = ref({
      title: "",
      source: "",
      type: "line",
      showPieLegend: false,
      showGrid: false,
      formatId: "2x2", // Format par défaut
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
      if (isUndoing.value) return;
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

      ChartModule.persistentStyles = JSON.parse(
        JSON.stringify(prevState.styles),
      );
      ChartModule.legendPos = JSON.parse(JSON.stringify(prevState.legendPos));
      config.value = JSON.parse(JSON.stringify(prevState.config));
      mapping.value = JSON.parse(JSON.stringify(prevState.mapping));
      items.value = JSON.parse(JSON.stringify(prevState.items));
      rawInput.value = prevState.rawInput;

      nextTick(() => {
        ChartModule.render(
          "#chart-container",
          items.value,
          mapping.value,
          config.value,
        );
        setTimeout(() => {
          isUndoing.value = false;
        }, 50);
      });
    };

    const parseData = (val) => {
      if (isUndoing.value) return;
      if (!val || !val.trim()) {
        items.value = [];
        return;
      }

      const rows = val.trim().split("\n");
      const heads = rows[0].split("\t").map((h) => h.trim());
      const dataRows = rows.slice(1);

      if (dataRows.length === 1 && config.value.type !== "pie") {
        const cols = dataRows[0].split("\t");
        items.value = heads.map((h, i) => ({
          category: h,
          valeur: parseFloat(cols[i]?.trim().replace(",", ".")) || 0,
        }));
        mapping.value.x = "category";
        mapping.value.yKeys = ["valeur"];
      } else {
        items.value = dataRows.map((row) => {
          const cols = row.split("\t");
          return heads.reduce((acc, h, i) => {
            const v = cols[i]?.trim().replace(",", ".");
            acc[h] = v === "" || isNaN(v) ? v : parseFloat(v);
            return acc;
          }, {});
        });
        if (heads.length > 0) {
          if (config.value.type === "pie") {
            mapping.value.x = null;
            mapping.value.yKeys = heads;
          } else {
            mapping.value.x = heads[0];
            mapping.value.yKeys = heads.slice(1);
          }
        }
      }
    };

    watch(rawInput, (nv) => parseData(nv));
    watch(
      [items, mapping, config],
      () => {
        if (!isUndoing.value) {
          saveState();
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
      formats, // Exposé à la vue
      currentTypeHint,
      currentPlaceholder,
      isTextSelected,
      applyToSerie,
      history,
      fileInput,
      saveState,
      headers: computed(() =>
        items.value.length ? Object.keys(items.value[0]) : [],
      ),
      actions: {
        setSize: (s, a) => {
          ChartModule.setFontSize(s, a);
          saveState();
        },
        bold: (a) => {
          ChartModule.toggleBold(a);
          saveState();
        },
        italic: (a) => {
          ChartModule.toggleItalic(a);
          saveState();
        },
        setBg: (c, a) => {
          ChartModule.setBgColor(c, a);
          saveState();
        },
        outline: (a) => {
          ChartModule.toggleOutline(a);
          saveState();
        },
        delete: () => {
          ChartModule.deleteText();
          saveState();
        },
        undo: () => undo(),
        exportPDF: () => {
          const svg = document.querySelector("#chart-container svg");
          if (svg) {
            if (typeof ExportModule !== "undefined") {
              // On passe toute la config pour qu'exporter.js lise le format choisi
              ExportModule.exportToPDF(svg, config.value);
            } else {
              alert("Le module d'exportation (exporter.js) n'est pas chargé.");
            }
          } else {
            alert("Aucun graphique à exporter.");
          }
        },
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
            const typeChoisi = config.value.type;
            isUndoing.value = true;
            ChartModule.persistentStyles = data.styles || {};
            ChartModule.legendPos = data.legendPos || { x: null, y: null };
            Object.assign(config.value, data.config);
            config.value.type = typeChoisi;
            rawInput.value = data.rawInput;
            isUndoing.value = false;
            parseData(rawInput.value);
            isUndoing.value = true;

            nextTick(() => {
              ChartModule.render(
                "#chart-container",
                items.value,
                mapping.value,
                config.value,
              );
              setTimeout(() => {
                isUndoing.value = false;
                saveState();
              }, 100);
            });
          } catch (err) {
            alert("Erreur lors de la lecture du fichier.");
          } finally {
            event.target.value = "";
          }
        };
        reader.readAsText(file);
      },
    };
  },
});
const vm = app.mount("#app");
window.appInstance = vm;
