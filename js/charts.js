const ChartModule = {
  colors: [
    "#0069b4",
    "#d42e1a",
    "#00876a",
    "#6f9ed4",
    "#e78868",
    "#79b2a1",
    "#fbbf24",
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
    const margin = { top: 70, right: 60, bottom: 80, left: 160 };
    const innerW = width - margin.left - margin.right,
      innerH = height - margin.top - margin.bottom;
    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const isHoriz = config.type === "horizontalBar",
      isPie = config.type === "pie",
      isBar = config.type === "bar" || isHoriz;
    const modeKey = isPie ? "pie" : isHoriz ? "hBar" : isBar ? "vBar" : "line";

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
        this.storeStyle(id, "offset", { x: event.x - ox, y: event.y - oy });
      })
      .on("end", () => {
        if (window.appInstance) window.appInstance.saveState();
      });

    if (isPie) {
      const radius = Math.min(innerW, innerH) / 2;
      const pieG = g
        .append("g")
        .attr("transform", `translate(${innerW / 2},${innerH / 2})`);
      const pieData = mapping.yKeys.map((key) => ({
        key,
        value: data[0][key],
      }));
      const pie = d3.pie().value((d) => d.value);
      const arc = d3.arc().innerRadius(0).outerRadius(radius);
      const labelArc = d3
        .arc()
        .innerRadius(radius * 0.75)
        .outerRadius(radius * 0.75);
      const arcs = pieG
        .selectAll(".arc")
        .data(pie(pieData))
        .enter()
        .append("g")
        .attr("class", "arc");
      arcs
        .append("path")
        .attr("d", arc)
        .attr("fill", (d, i) => this.colors[i % this.colors.length])
        .attr("stroke", "white")
        .style("stroke-width", "2px")
        .attr("opacity", 0.8);
      arcs.each((d, i) => {
        const center = labelArc.centroid(d);
        const idVal = `p-${i}-0-val`,
          idTxt = `p-${i}-0-txt`;
        const sVal = this.persistentStyles[idVal] || {},
          sTxt = this.persistentStyles[idTxt] || {};
        const offVal = sVal.offsets?.[modeKey] || { x: 0, y: -10 },
          offTxt = sTxt.offsets?.[modeKey] || { x: 0, y: 12 };
        if (!sVal.deleted)
          this.addInteractiveText(
            pieG,
            center[0] + offVal.x,
            center[1] + offVal.y,
            sVal.text || d.data.value,
            "font-bold",
            true,
            drag,
            null,
            sVal.fill || this.colors[i % this.colors.length],
            i,
            idVal,
            center[0],
            center[1],
          );
        if (!config.showPieLegend && !sTxt.deleted)
          this.addInteractiveText(
            pieG,
            center[0] + offTxt.x,
            center[1] + offTxt.y,
            sTxt.text || d.data.key,
            "text-[10px]",
            true,
            drag,
            null,
            sTxt.fill || this.colors[i % this.colors.length],
            i,
            idTxt,
            center[0],
            center[1],
          );
      });
    } else {
      const xLabels = data.map((d, i) => (mapping.x ? d[mapping.x] : i + 1));
      const maxY = d3.max(data, (d) => d3.max(mapping.yKeys, (k) => d[k] || 0));
      let xScale, yScale, ySub, xSub;

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
          .padding(0.1);
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
              .padding(0.1)
          : null;
      }

      if (config.showGrid) {
        const gridG = g.append("g").attr("class", "grid");
        if (isHoriz)
          gridG
            .attr("transform", `translate(0,${innerH})`)
            .call(d3.axisBottom(xScale).tickSize(-innerH).tickFormat(""));
        else gridG.call(d3.axisLeft(yScale).tickSize(-innerW).tickFormat(""));
        gridG
          .selectAll("line")
          .attr("stroke", "#e2e8f0")
          .attr("stroke-dasharray", "2,2");
        gridG.select("path").remove();
      }

      if (isHoriz) {
        g.append("g")
          .attr("transform", `translate(0,${innerH})`)
          .call(d3.axisBottom(xScale));
        g.append("g").call(d3.axisLeft(yScale).tickFormat(""));
      } else {
        g.append("g")
          .attr("transform", `translate(0,${innerH})`)
          .call(d3.axisBottom(xScale).tickFormat(""));
        g.append("g").call(d3.axisLeft(yScale));
      }

      mapping.yKeys.forEach((key, index) => {
        const color = this.colors[index % this.colors.length];

        if (isHoriz) {
          g.selectAll(`.bar-${index}`)
            .data(data)
            .enter()
            .append("rect")
            .attr("y", (d, i) => yScale(xLabels[i]) + ySub(key))
            .attr("x", 0)
            .attr("height", ySub.bandwidth())
            .attr("width", (d) => xScale(d[key] || 0))
            .attr("fill", color)
            .attr("opacity", 0.8);
        } else if (isBar) {
          g.selectAll(`.bar-${index}`)
            .data(data)
            .enter()
            .append("rect")
            .attr("x", (d, i) => xScale(xLabels[i]) + xSub(key))
            .attr("y", (d) => yScale(d[key] || 0))
            .attr("width", xSub.bandwidth())
            .attr("height", (d) => innerH - yScale(d[key] || 0))
            .attr("fill", color)
            .attr("opacity", 0.8);
        } else {
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
        }

        data.forEach((d, i) => {
          let cx, cy;
          if (isHoriz) {
            cx = xScale(d[key] || 0);
            cy = yScale(xLabels[i]) + ySub(key) + ySub.bandwidth() / 2;
          } else {
            cx =
              xScale(xLabels[i]) +
              (isBar
                ? xSub(key) + xSub.bandwidth() / 2
                : xScale.bandwidth() / 2);
            cy = yScale(d[key] || 0);
          }

          const idVal = `p-${index}-${i}-val`;
          const idTxt = `axis-label-${i}`;

          const sVal = this.persistentStyles[idVal] || {};
          const sTxt = this.persistentStyles[idTxt] || {};

          let defaultYOffset = isHoriz ? 0 : -20;
          let offVal =
            sVal.offsets?.[modeKey] ||
            (isHoriz ? { x: 35, y: 0 } : { x: 0, y: defaultYOffset });
          let offTxt = sTxt.offsets?.[modeKey] || { x: 0, y: 0 };

          if (!sVal.deleted) {
            this.addInteractiveText(
              g,
              cx + offVal.x,
              cy + offVal.y,
              sVal.text || d[key],
              "font-bold",
              true,
              drag,
              null,
              sVal.fill || color,
              index,
              idVal,
              cx,
              cy,
            );
          }

          if (index === 0 && !sTxt.deleted) {
            let labelX, labelY;

            if (isHoriz) {
              // Rapproché à gauche : -10px au lieu de -20px
              labelX = -10;
              labelY = yScale(xLabels[i]) + yScale.bandwidth() / 2;
            } else {
              labelX = xScale(xLabels[i]) + xScale.bandwidth() / 2;
              // Rapproché en bas : +15px au lieu de +30px
              labelY = innerH + 15;
            }

            const grp = this.addInteractiveText(
              g,
              labelX + offTxt.x,
              labelY + offTxt.y,
              sTxt.text || xLabels[i],
              "text-[12px] font-bold uppercase",
              !isHoriz,
              drag,
              "#000",
              "transparent",
              "axis",
              idTxt,
              labelX,
              labelY,
            );

            if (isHoriz) grp.select("text").attr("text-anchor", "end");
          }
        });
      });
    }

    const tStyle = this.persistentStyles["main-title"] || {},
      tOff = tStyle.offsets?.universal || { x: 0, y: 0 };
    this.addInteractiveText(
      svg,
      400 + tOff.x,
      30 + tOff.y,
      tStyle.text || config.title || "Titre",
      "text-xl font-bold",
      true,
      drag,
      "#000",
      "transparent",
      "title",
      "main-title",
      400,
      30,
    );
    this.renderLegend(svg, width, margin, mapping, drag, config);
    this.applyAllStyles();
  },

  renderLegend(svg, width, margin, mapping, drag, config) {
    if (
      (mapping.yKeys.length === 1 && config.type !== "pie") ||
      (config.type === "pie" && !config.showPieLegend)
    ) {
      svg.selectAll(".legend-container").remove();
      return;
    }
    const lx = this.legendPos.x || width - 120,
      ly = this.legendPos.y || 70;
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
        .attr("transform", `translate(0, ${index * 24})`);

      const color = this.colors[index % this.colors.length];
      const idLeg = `leg-${index}`,
        s = this.persistentStyles[idLeg] || {},
        off = s.offsets?.universal || { x: 0, y: 0 };

      item
        .append("rect")
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", color)
        .attr("y", -7.5);

      this.addInteractiveText(
        item,
        20 + off.x,
        0 + off.y,
        s.text || key,
        "text-sm italic font-light",
        false,
        drag,
        "#000",
        "transparent",
        index,
        idLeg,
        20,
        0,
      );
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
    ox,
    oy,
  ) {
    const group = container
      .append("g")
      .attr("class", "editable-group")
      .attr("data-serie", serieId)
      .attr("data-id", uniqueId)
      .attr("data-origin-x", ox)
      .attr("data-origin-y", oy)
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
      .attr("dominant-baseline", "central")
      .attr("alignment-baseline", "central")
      .attr("class", classes)
      .style("font-size", "14px")
      .text(text);

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

    return group;
  },

  updateCartouche(group) {
    const text = group.select("text"),
      rect = group.select("rect");

    const bbox = text.node().getBBox(),
      p = 5;
    rect
      .attr("x", bbox.x - p)
      .attr("y", bbox.y - p)
      .attr("width", bbox.width + p * 2)
      .attr("height", bbox.height + p * 2);
    const f = rect.attr("fill");
    text.attr("fill", f === "transparent" ? "#000" : this.getContrastColor(f));
  },

  storeStyle(id, prop, val) {
    if (!this.persistentStyles[id]) this.persistentStyles[id] = {};
    if (prop === "offset") {
      if (!this.persistentStyles[id].offsets)
        this.persistentStyles[id].offsets = {};
      const type = window.appInstance.config.type;
      const key =
        id === "main-title" || id.startsWith("leg") || id.startsWith("axis")
          ? "universal"
          : type === "horizontalBar"
            ? "hBar"
            : type === "pie"
              ? "pie"
              : type === "bar"
                ? "vBar"
                : "line";
      this.persistentStyles[id].offsets[key] = val;
    } else {
      this.persistentStyles[id][prop] = val;
    }
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
      const txt = g.select("text"),
        rct = g.select("rect");

      if (s.fill) rct.attr("fill", s.fill);
      if (s.stroke) {
        rct.attr("stroke", s.stroke);
        rct.attr(
          "stroke-width",
          s.stroke === "transparent" || s.stroke === "none" ? "0" : "1.5px",
        );
      }
      if (s.fontSize) txt.style("font-size", s.fontSize);
      if (s.fontWeight) txt.style("font-weight", s.fontWeight);
      if (s.fontStyle) txt.style("font-style", s.fontStyle);
      if (s.text) txt.text(s.text);
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
    input.style.top = matrix.f + window.scrollY - bbox.height / 2 + "px";
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
      const r = g.select("rect");
      let targetColor = c;
      const id = g.attr("data-id");

      // Si on clique sur le bouton "Transparent" (🚫)
      if (c === "transparent" || c === "none") {
        const currentFill = r.attr("fill");
        const currentStroke = r.attr("stroke");

        // Si l'élément est DÉJÀ transparent (fond et contour), on le remet à son état initial
        if (
          (currentFill === "transparent" || currentFill === "none") &&
          (currentStroke === "transparent" || currentStroke === "none")
        ) {
          // L'état initial d'une bulle de valeur (commence par "p-") est sa couleur de série
          if (id && id.startsWith("p-")) {
            const serieId = g.attr("data-serie");
            const idx = parseInt(serieId);
            if (!isNaN(idx)) {
              targetColor = this.colors[idx % this.colors.length];
            }
          } else {
            // L'état initial d'une légende, d'un axe ou d'un titre est transparent
            targetColor = "transparent";
          }
        }

        // On supprime les éventuels contours pour revenir à un état parfaitement propre
        r.attr("stroke", "none").attr("stroke-width", "0");
        this.storeStyle(id, "stroke", "none");
      } else {
        // Si on choisit une vraie couleur (ex: bleu), on enlève le contour pour un rendu net
        r.attr("stroke", "none").attr("stroke-width", "0");
        this.storeStyle(id, "stroke", "none");
      }

      r.attr("fill", targetColor);
      this.storeStyle(id, "fill", targetColor);
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
        f = r.attr("fill"),
        s = r.attr("stroke");

      if (f && f !== "transparent" && f !== "none") {
        // 1. S'il a un fond coloré -> Il devient un contour de la même couleur
        r.attr("stroke", f)
          .attr("fill", "transparent")
          .attr("stroke-width", "1.5px");
        this.storeStyle(g.attr("data-id"), "stroke", f);
        this.storeStyle(g.attr("data-id"), "fill", "transparent");
      } else if (s && s !== "transparent" && s !== "none") {
        // 2. S'il a déjà un contour coloré -> Il redevient un fond solide
        r.attr("fill", s)
          .attr("stroke", "transparent")
          .attr("stroke-width", "0");
        this.storeStyle(g.attr("data-id"), "fill", s);
        this.storeStyle(g.attr("data-id"), "stroke", "transparent");
      } else {
        // 3. S'il est 100% transparent (comme la légende) -> On ajoute un contour !
        let newColor = "#333333";
        const serieId = g.attr("data-serie");

        // Petite magie : on récupère la couleur de la courbe correspondante
        if (serieId && serieId !== "title" && serieId !== "axis") {
          const idx = parseInt(serieId);
          if (!isNaN(idx)) newColor = this.colors[idx % this.colors.length];
        }

        r.attr("stroke", newColor)
          .attr("fill", "transparent")
          .attr("stroke-width", "1.5px");
        this.storeStyle(g.attr("data-id"), "stroke", newColor);
        this.storeStyle(g.attr("data-id"), "fill", "transparent");
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

    // On isole le début de l'ID pour savoir si on a cliqué sur un point ("p-...") ou une légende ("leg-...")
    const selectedPrefix = this.selectedText.attr("data-id").split("-")[0];

    d3.selectAll(`.editable-group[data-serie='${sId}']`).each(function () {
      const g = d3.select(this);

      // On n'applique la modification QUE si c'est le même type d'élément
      // (ex: si on a cliqué sur une bulle, on ne modifie que les bulles, on ignore la légende)
      if (g.attr("data-id").startsWith(selectedPrefix)) {
        cb(g);
      }
    });

    if (window.appInstance) window.appInstance.saveState();
  },
};
