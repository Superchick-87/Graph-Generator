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
    return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? "#000000" : "#FFFFFF";
  },

  render(containerId, data, mapping, config) {
    const container = d3.select(containerId);
    if (!data.length || !mapping.yKeys.length) {
      container.select("svg").remove();
      return;
    }

    let svg = container.select("svg");
    if (svg.empty()) {
      svg = container
        .append("svg")
        .attr("viewBox", `0 0 800 500`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%")
        .style("height", "auto")
        .style("background", "transparent")
        .on("click", (e) => {
          if (e.target.tagName === "svg") this.deselectText();
        });
    }
    svg.selectAll("*").remove();

    const width = 800,
      height = 500;
    const margin = { top: 70, right: 40, bottom: 60, left: 100 };
    const innerW = width - margin.left - margin.right,
      innerH = height - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const isHoriz = config.type === "horizontalBar";
    const isBar = config.type === "bar" || isHoriz;
    const modeKey = isBar ? (isHoriz ? "hBar" : "vBar") : "line"; // Clé pour la mémoire de position

    const xLabels = data.map((d, i) => (mapping.x ? d[mapping.x] : i + 1));
    const maxY = d3.max(data, (d) => d3.max(mapping.yKeys, (k) => d[k] || 0));

    let xScale, yScale, xSub, ySub;
    if (isHoriz) {
      yScale = d3.scaleBand().range([0, innerH]).padding(0.3).domain(xLabels);
      xScale = d3
        .scaleLinear()
        .range([0, innerW])
        .domain([0, (maxY || 10) * 1.15])
        .nice();
      ySub = d3
        .scaleBand()
        .domain(mapping.yKeys)
        .range([0, yScale.bandwidth()])
        .padding(0.05);
    } else {
      xScale = d3.scaleBand().range([0, innerW]).padding(0.3).domain(xLabels);
      yScale = d3
        .scaleLinear()
        .range([innerH, 0])
        .domain([0, (maxY || 10) * 1.15])
        .nice();
      xSub = isBar
        ? d3
            .scaleBand()
            .domain(mapping.yKeys)
            .range([0, xScale.bandwidth()])
            .padding(0.05)
        : null;
    }

    g.append("g")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(xScale));
    g.append("g").call(d3.axisLeft(yScale));

    const drag = d3
      .drag()
      .on("drag", (event) => {
        const node = d3.select(
          event.sourceEvent.target.closest(".editable-group"),
        );
        if (node.empty()) return;
        const id = node.attr("data-id"),
          ox = +node.attr("data-origin-x"),
          oy = +node.attr("data-origin-y");
        node.attr("transform", `translate(${event.x},${event.y})`);

        // On enregistre l'offset spécifiquement pour le mode actuel (line, vBar ou hBar)
        if (!this.persistentStyles[id]) this.persistentStyles[id] = {};
        if (!this.persistentStyles[id].offsets)
          this.persistentStyles[id].offsets = {};
        this.persistentStyles[id].offsets[modeKey] = {
          x: event.x - ox,
          y: event.y - oy,
        };
      })
      .on("end", () => {
        if (window.appInstance) window.appInstance.saveState();
      });

    mapping.yKeys.forEach((key, index) => {
      const color = this.colors[index % this.colors.length];
      if (!isBar) {
        const lineGen = d3
          .line()
          .x((d, i) => xScale(xLabels[i]) + xScale.bandwidth() / 2)
          .y((d) => yScale(d[key] || 0));
        g.append("path")
          .datum(data)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-width", 3)
          .attr("d", lineGen);
      } else if (isHoriz) {
        g.selectAll(`.bar-${index}`)
          .data(data)
          .enter()
          .append("rect")
          .attr("y", (d, i) => yScale(xLabels[i]) + ySub(key))
          .attr("x", 0)
          .attr("height", ySub.bandwidth())
          .attr("width", (d) => xScale(d[key] || 0))
          .attr("fill", color)
          .attr("opacity", 0.7);
      } else {
        g.selectAll(`.bar-${index}`)
          .data(data)
          .enter()
          .append("rect")
          .attr("x", (d, i) => xScale(xLabels[i]) + xSub(key))
          .attr("y", (d) => yScale(d[key] || 0))
          .attr("width", xSub.bandwidth())
          .attr("height", (d) => innerH - yScale(d[key] || 0))
          .attr("fill", color)
          .attr("opacity", 0.7);
      }

      data.forEach((d, i) => {
        let cx, cy;
        if (isHoriz) {
          cx = xScale(d[key] || 0);
          cy = yScale(xLabels[i]) + ySub(key) + ySub.bandwidth() / 2;
        } else {
          cx =
            xScale(xLabels[i]) +
            (isBar ? xSub(key) + xSub.bandwidth() / 2 : xScale.bandwidth() / 2);
          cy = yScale(d[key] || 0);
        }

        const id = `p-${index}-${i}`,
          style = this.persistentStyles[id] || {};

        // RÉCUPÉRATION DE L'OFFSET PAR MODE
        // On cherche d'abord si un offset existe pour ce mode précis
        let off =
          style.offsets && style.offsets[modeKey]
            ? style.offsets[modeKey]
            : null;

        // Si aucun offset manuel, on met la position par défaut selon le mode
        if (!off) {
          off = isHoriz ? { x: 25, y: 0 } : { x: 0, y: -25 };
        }

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
            style.fill || color,
            index,
            id,
          );
          d3.select(`[data-id='${id}']`)
            .attr("data-origin-x", cx)
            .attr("data-origin-y", cy);
        }
      });
    });

    // TITRE
    const tStyle = this.persistentStyles["main-title"] || {};
    // Le titre garde un offset universel car sa position ne dépend pas du type de graph
    const tOff =
      tStyle.offsets && tStyle.offsets.universal
        ? tStyle.offsets.universal
        : tStyle.offset || { x: 0, y: 0 };

    this.addInteractiveText(
      svg,
      400 + tOff.x,
      30 + tOff.y,
      config.title || "Titre",
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
      .attr("data-origin-y", 30);

    this.renderLegend(svg, width, margin, mapping, drag);
    this.applyAllStyles();
  },

  // Modification pour le titre qui doit rester au même endroit
  storeStyle(id, prop, val) {
    if (!this.persistentStyles[id]) this.persistentStyles[id] = {};
    if (prop === "offset") {
      if (!this.persistentStyles[id].offsets)
        this.persistentStyles[id].offsets = {};
      // Si c'est le titre, on utilise une clé universelle
      const key =
        id === "main-title"
          ? "universal"
          : this.lastRenderedType === "horizontalBar"
            ? "hBar"
            : this.lastRenderedType === "bar"
              ? "vBar"
              : "line";
      this.persistentStyles[id].offsets[key] = val;
    } else {
      this.persistentStyles[id][prop] = val;
    }
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
    const label =
      this.persistentStyles[uniqueId] && this.persistentStyles[uniqueId].text
        ? this.persistentStyles[uniqueId].text
        : text;
    group
      .append("text")
      .attr("text-anchor", centered ? "middle" : "start")
      .attr("class", classes)
      .style("font-size", "12px")
      .text(label);
    this.updateCartouche(group);
    group
      .on("click", (e) => {
        e.stopPropagation();
        this.selectText(group);
      })
      .on("dblclick", (e) => {
        e.stopPropagation();
        this.makeInlineEditable(group.select("text"), group);
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
      if (s.text) g.select("text").text(s.text);
      this.updateCartouche(g);
    });
  },

  makeInlineEditable(d3Text, group) {
    const el = d3Text.node(),
      bbox = el.getBBox(),
      matrix = el.getScreenCTM();
    d3Text.style("visibility", "hidden");
    const input = document.createElement("input");
    input.value = d3Text.text();
    input.style.position = "absolute";
    input.style.left = matrix.e + window.scrollX + "px";
    input.style.top = matrix.f + window.scrollY - bbox.height + "px";
    document.body.appendChild(input);
    input.focus();
    const save = () => {
      d3Text.text(input.value).style("visibility", "visible");
      this.storeStyle(group.attr("data-id"), "text", input.value);
      this.updateCartouche(group);
      if (input.parentNode) input.parentNode.removeChild(input);
      if (window.appInstance) window.appInstance.saveState();
    };
    input.onkeydown = (e) => {
      if (e.key === "Enter") save();
    };
    input.onblur = save;
  },

  setBgColor(c, all) {
    const fn = (g) => {
      g.select("rect").attr("fill", c).attr("stroke", "none");
      this.storeStyle(g.attr("data-id"), "fill", c);
      this.updateCartouche(g);
    };
    all ? this.applyToSerie(fn) : this.selectedText && fn(this.selectedText);
    if (window.appInstance) window.appInstance.saveState();
  },
  setFontSize(s, all) {
    const fn = (g) => {
      g.select("text").style("font-size", s + "px");
      this.storeStyle(g.attr("data-id"), "fontSize", s + "px");
      this.updateCartouche(g);
    };
    all ? this.applyToSerie(fn) : this.selectedText && fn(this.selectedText);
    if (window.appInstance) window.appInstance.saveState();
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
    all ? this.applyToSerie(fn) : this.selectedText && fn(this.selectedText);
    if (window.appInstance) window.appInstance.saveState();
  },
  toggleItalic(all) {
    const fn = (g) => {
      const t = g.select("text"),
        s = t.style("font-style") === "italic" ? "normal" : "italic";
      t.style("font-style", s);
      this.storeStyle(g.attr("data-id"), "fontStyle", s);
      this.updateCartouche(g);
    };
    all ? this.applyToSerie(fn) : this.selectedText && fn(this.selectedText);
    if (window.appInstance) window.appInstance.saveState();
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
    all ? this.applyToSerie(fn) : this.selectedText && fn(this.selectedText);
    if (window.appInstance) window.appInstance.saveState();
  },
  deleteText() {
    if (this.selectedText) {
      const id = this.selectedText.attr("data-id");
      this.storeStyle(id, "deleted", true);
      this.selectedText.remove();
      this.deselectText();
      if (window.appInstance) window.appInstance.saveState();
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
    if (window.appInstance) window.appInstance.saveState();
  },

  renderLegend(svg, width, margin, mapping, drag) {
    const lx = this.legendPos.x || width - 150,
      ly = this.legendPos.y || 60;
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

      const s = this.persistentStyles[id] || {};
      // Pour la légende, on utilise aussi un offset universel (ne dépend pas du type de graph)
      const off =
        s.offsets && s.offsets.universal
          ? s.offsets.universal
          : s.offset || { x: 0, y: 0 };

      this.addInteractiveText(
        item,
        20 + off.x,
        10 + off.y,
        key,
        "font-bold",
        false,
        drag,
        null,
        "transparent",
        id,
        id,
      );
    });
  },
};
