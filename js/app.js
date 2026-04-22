const { createApp, ref, computed, watch, nextTick } = Vue;

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

    // --- SYSTÈME D'ANNULATION (UNDO) ---
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

    // --- LOGIQUE DE DONNÉES ---
    const parseData = (val) => {
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

    // --- PROJET ---
    const saveProject = () => {
      const fileName = prompt(
        "Nom du fichier :",
        config.value.title || "export",
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
    };

    const openProject = (event) => {
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
          alert("Format invalide.");
        }
      };
      reader.readAsText(file);
    };

    return {
      rawInput,
      items,
      mapping,
      config,
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
      saveProject,
      openProject,
      saveState,
    };
  },
});
const vm = app.mount("#app");
window.appInstance = vm;
