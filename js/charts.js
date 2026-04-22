const ChartModule = {
  colors: [
    "#0069b4",
    "#d42e1a",
    "#00876a",
    "#6f9ed4",
    "#e78868",
    "#79b2a1",
    "#000000",
  ],
  selectedText: null,
  persistentStyles: {},
  legendPos: { x: null, y: null },

  getContrastColor(hexColor) {
    if (!hexColor || hexColor === "transparent") return "#000000";
    const r = parseInt(hexColor.slice(1, 3), 16),
      g = parseInt(hexColor.slice(3, 5), 16),
      b = parseInt(hexColor.slice(5, 7), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? "#000000" : "#FFFFFF";
  },

  render(containerId, data, mapping, config) {
    if (
      !data ||
      data.length === 0 ||
      !mapping.yKeys ||
      mapping.yKeys.length === 0
    ) {
      d3.select(containerId).select("svg").remove();
      return;
    }

    const container = d3.select(containerId);
    // On garde le SVG s'il existe mais on vide le contenu pour reconstruire proprement
    let svg = container.select("svg");
    if (svg.empty()) {
      svg = container
        .append("svg")
        .attr("viewBox", `0 0 800 500`)
        .style("background", "white")
        .on("click", (e) => {
          if (!e.target.closest(".editable-group")) this.deselectText();
        });
    }
    svg.selectAll("*").remove(); // Nettoyage complet pour l'édition dynamique

    const width = 800,
      height = 500,
      margin = { top: 80, right: 100, bottom: 80, left: 80 };
    const innerW = width - margin.left - margin.right,
      innerH = height - margin.top - margin.bottom;
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const xLabels = data.map((d, i) => (mapping.x ? d[mapping.x] : i + 1));
    const x = d3.scaleBand().range([0, innerW]).padding(0.3).domain(xLabels);
    const maxY = d3.max(data, (d) => d3.max(mapping.yKeys, (k) => d[k] || 0));
    const y = d3
      .scaleLinear()
      .range([innerH, 0])
      .domain([0, (maxY || 10) * 1.2])
      .nice();

    // Axes
    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x));
    g.append("g").call(d3.axisLeft(y));

    const drag = d3
      .drag()
      .on("drag", (event) => {
        const node = d3.select(
          event.sourceEvent.target.closest(".editable-group"),
        );
        const id = node.attr("data-id"),
          ox = +node.attr("data-origin-x"),
          oy = +node.attr("data-origin-y");
        node.attr("transform", `translate(${event.x},${event.y})`);
        this.storeStyle(id, "offset", { x: event.x - ox, y: event.y - oy });
      })
      .on("end", () => {
        if (window.appInstance) window.appInstance.saveState();
      });

    // Titre
    const tStyle = this.persistentStyles["main-title"] || {},
      tOff = tStyle.offset || { x: 0, y: 0 };
    this.addInteractiveText(
      svg,
      400 + tOff.x,
      40 + tOff.y,
      config.title || "",
      "text-xl font-bold",
      true,
      drag,
      "#000",
      "transparent",
      "title",
      "main-title",
    );
    svg
      .select("[data-id='main-title']")
      .attr("data-origin-x", 400)
      .attr("data-origin-y", 40);

    // Séries
    mapping.yKeys.forEach((key, index) => {
      const color = this.colors[index % this.colors.length];
      const lineGen = d3
        .line()
        .x((d, i) => x(xLabels[i]) + x.bandwidth() / 2)
        .y((d) => y(d[key] || 0));

      g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", 3)
        .attr("d", lineGen);

      data.forEach((d, i) => {
        const cx = x(xLabels[i]) + x.bandwidth() / 2,
          cy = y(d[key] || 0),
          id = `p-${index}-${i}`;
        const style = this.persistentStyles[id] || {},
          off = style.offset || { x: 0, y: -25 };

        if (!style.deleted) {
          this.addInteractiveText(
            g,
            cx + off.x,
            cy + off.y,
            d[key],
            "font-bold",
            true,
            drag,
            null,
            color,
            index,
            id,
          );
          d3.select(`[data-id='${id}']`)
            .attr("data-origin-x", cx)
            .attr("data-origin-y", cy);
        }
      });
    });

    this.renderLegend(svg, width, margin, mapping, drag);
    this.applyAllStyles();
  },

  renderLegend(svg, width, margin, mapping, drag) {
    const lx = this.legendPos.x || width - 150,
      ly = this.legendPos.y || 100;
    const leg = svg
      .append("g")
      .attr("class", "legend-container")
      .attr("transform", `translate(${lx}, ${ly})`)
      .call(
        d3.drag().on("drag", (event) => {
          this.legendPos = { x: event.x, y: event.y };
          d3.select(".legend-container").attr(
            "transform",
            `translate(${event.x},${event.y})`,
          );
        }),
      );
    mapping.yKeys.forEach((key, index) => {
      const item = leg
          .append("g")
          .attr("transform", `translate(0, ${index * 25})`),
        color = this.colors[index % this.colors.length],
        id = `leg-${index}`;
      item
        .append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("fill", color);
      const lStyle = this.persistentStyles[id] || {},
        lOff = lStyle.offset || { x: 0, y: 0 };
      this.addInteractiveText(
        item,
        20 + lOff.x,
        10 + lOff.y,
        key,
        "font-bold",
        false,
        drag,
        null,
        "transparent",
        id,
        id,
      );
      item
        .select(".editable-group")
        .attr("data-origin-x", 20)
        .attr("data-origin-y", 10);
    });
  },

  addInteractiveText(
    container,
    x,
    y,
    text,
    classes,
    centered,
    drag,
    textColor,
    bgColor,
    serieId,
    uniqueId,
  ) {
    const group = container
      .append("g")
      .attr("class", "editable-group")
      .attr("data-serie", serieId)
      .attr("data-id", uniqueId)
      .attr("transform", `translate(${x},${y})`);
    if (drag) group.call(drag).style("cursor", "move");
    group
      .append("rect")
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("fill", bgColor || "transparent");
    group
      .append("text")
      .attr("text-anchor", centered ? "middle" : "start")
      .attr("class", classes)
      .style("font-size", "12px")
      .text(text);
    this.updateCartouche(group);
    group.on("click", (e) => {
      e.stopPropagation();
      this.selectText(group);
    });
  },

  updateCartouche(group) {
    const text = group.select("text"),
      rect = group.select("rect"),
      bbox = text.node().getBBox(),
      p = 5;
    rect
      .attr("x", bbox.x - p)
      .attr("y", bbox.y - p)
      .attr("width", bbox.width + p * 2)
      .attr("height", bbox.height + p * 2);
    const f = rect.attr("fill"),
      s = rect.attr("stroke");
    text.attr(
      "fill",
      f === "transparent" || (s && s !== "none")
        ? "#000"
        : this.getContrastColor(f),
    );
  },

  storeStyle(id, prop, val) {
    if (!this.persistentStyles[id]) this.persistentStyles[id] = {};
    this.persistentStyles[id][prop] = val;
  },

  applyAllStyles() {
    Object.keys(this.persistentStyles).forEach((id) => {
      const g = d3.select(`[data-id='${id}']`);
      if (g.empty()) return;
      const s = this.persistentStyles[id];
      if (s.deleted) {
        g.remove();
        return;
      }
      if (s.fill) g.select("rect").attr("fill", s.fill);
      if (s.stroke) g.select("rect").attr("stroke", s.stroke);
      if (s.fontSize) g.select("text").style("font-size", s.fontSize);
      if (s.fontWeight) g.select("text").style("font-weight", s.fontWeight);
      if (s.fontStyle) g.select("text").style("font-style", s.fontStyle);
      this.updateCartouche(g);
    });
  },

  toggleBold(all) {
    const fn = (g) => {
      const t = g.select("text"),
        curr = t.style("font-weight");
      const w = curr === "bold" || curr === "700" ? "normal" : "bold";
      t.style("font-weight", w);
      this.storeStyle(g.attr("data-id"), "fontWeight", w);
      this.updateCartouche(g);
    };
    all ? this.applyToSerie(fn) : fn(this.selectedText);
  },

  toggleItalic(all) {
    const fn = (g) => {
      const t = g.select("text"),
        s = t.style("font-style") === "italic" ? "normal" : "italic";
      t.style("font-style", s);
      this.storeStyle(g.attr("data-id"), "fontStyle", s);
      this.updateCartouche(g);
    };
    all ? this.applyToSerie(fn) : fn(this.selectedText);
  },

  toggleOutline(all) {
    const fn = (g) => {
      const r = g.select("rect"),
        f = r.attr("fill");
      if (f !== "transparent") {
        r.attr("stroke", f)
          .attr("fill", "transparent")
          .attr("stroke-width", "1.5px");
        this.storeStyle(g.attr("data-id"), "stroke", f);
        this.storeStyle(g.attr("data-id"), "fill", "transparent");
      } else {
        const s = r.attr("stroke");
        r.attr("fill", s || "#000").attr("stroke", "none");
        this.storeStyle(g.attr("data-id"), "fill", s || "#000");
        this.storeStyle(g.attr("data-id"), "stroke", "none");
      }
      this.updateCartouche(g);
    };
    all ? this.applyToSerie(fn) : fn(this.selectedText);
  },

  setBgColor(c, all) {
    const fn = (g) => {
      g.select("rect").attr("fill", c).attr("stroke", "none");
      this.storeStyle(g.attr("data-id"), "fill", c);
      this.updateCartouche(g);
    };
    all ? this.applyToSerie(fn) : fn(this.selectedText);
  },

  setFontSize(s, all) {
    const fn = (g) => {
      g.select("text").style("font-size", s + "px");
      this.storeStyle(g.attr("data-id"), "fontSize", s + "px");
      this.updateCartouche(g);
    };
    all ? this.applyToSerie(fn) : fn(this.selectedText);
  },

  deleteText() {
    if (this.selectedText) {
      const id = this.selectedText.attr("data-id");
      this.storeStyle(id, "deleted", true);
      this.selectedText.remove();
      this.deselectText();
    }
  },

  selectText(g) {
    this.deselectText();
    this.selectedText = g;
    g.select("rect").style("outline", "2px solid #0069b4");
    if (window.appInstance) window.appInstance.onTextSelected(true);
  },

  deselectText() {
    if (this.selectedText)
      this.selectedText.select("rect").style("outline", "none");
    this.selectedText = null;
    if (window.appInstance) window.appInstance.onTextSelected(false);
  },

  applyToSerie(cb) {
    if (!this.selectedText) return;
    const sId = this.selectedText.attr("data-serie");
    d3.selectAll(`.editable-group[data-serie='${sId}']`).each(function () {
      cb(d3.select(this));
    });
  },
};
