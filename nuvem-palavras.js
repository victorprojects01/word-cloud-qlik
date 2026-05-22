define([
  "qlik",
  "./d3.min",
  "./d3.layout.cloud",
  "css!./nuvem-palavras.css"
], function (qlik, d3, cloud) {

  function normalizeWord(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9à-ÿ]/gi, "")
      .trim();
  }

  function cleanDisplayWord(value) {
    return String(value || "")
      .replace(/[^\wÀ-ÿ]/g, "")
      .trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatNumber(value) {
    if (typeof value !== "number" || isNaN(value)) {
      return "0";
    }

    return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  }

  function splitColors(value, fallback) {
    var text = String(value || "").trim();
    if (!text) {
      return fallback;
    }

    var colors = text.split(/[;,]/).map(function (item) {
      return item.trim();
    }).filter(Boolean);

    return colors.length ? colors : fallback;
  }



  function getColorPickerValue(value, fallback) {
    if (!value) {
      return fallback;
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "object") {
      if (value.color) {
        return value.color;
      }
      if (value.value) {
        return value.value;
      }
    }

    return fallback;
  }

  function getPaletteFromProps(props, fallback) {
    var colors = [
      getColorPickerValue(props.paletteColor1, "#4477aa"),
      getColorPickerValue(props.paletteColor2, "#7d8cc4"),
      getColorPickerValue(props.paletteColor3, "#dce4ff"),
      getColorPickerValue(props.paletteColor4, "#ffe082"),
      getColorPickerValue(props.paletteColor5, "#ffb300"),
      getColorPickerValue(props.paletteColor6, "#ff7f0e"),
      getColorPickerValue(props.paletteColor7, "#e31a1c")
    ].filter(Boolean);

    return colors.length ? colors : fallback;
  }

  function getThemeColors(theme, fallback, preferredIndex) {
    try {
      var palettes = theme && theme.properties && theme.properties.palettes;
      var dataPalettes = palettes && palettes.data;

      if (dataPalettes && dataPalettes.length) {
        var index = Number(preferredIndex);
        if (isNaN(index) || index < 0 || index >= dataPalettes.length) {
          index = 0;
        }

        var preferredPalette = dataPalettes[index];
        if (preferredPalette && preferredPalette.scale && preferredPalette.scale.length) {
          return preferredPalette.scale;
        }
        if (preferredPalette && preferredPalette.colors && preferredPalette.colors.length) {
          return preferredPalette.colors;
        }

        for (var i = 0; i < dataPalettes.length; i += 1) {
          var palette = dataPalettes[i];
          if (palette && palette.scale && palette.scale.length) {
            return palette.scale;
          }
          if (palette && palette.colors && palette.colors.length) {
            return palette.colors;
          }
        }
      }
    } catch (e) {}

    return fallback;
  }

  function getPresetColors(scheme, fallback) {
    var schemes = {
      standard: ["#4477aa", "#7d8cc4", "#dce4ff", "#ffe082", "#ffb300", "#ff7f0e", "#e31a1c"],
      meta: ["#dce4ff", "#2f75b5", "#ffe133"],
      pais: ["#83899f", "#747b94", "#666d87"],
      estado: ["#ffd79a", "#ffc36a", "#f5a623"],
      cidade: ["#ffc266", "#ff9f2d", "#f58220"],
      qlikBlue: ["#b8d9ff", "#7db7f0", "#4477aa", "#1f4e79"],
      qlikGreen: ["#d4f4dd", "#8fd19e", "#3fa65a", "#1f6f3a"],
      qlikPurple: ["#eadcff", "#b894f6", "#7e57c2", "#4a2c82"],
      qlikOrange: ["#ffe2bd", "#ffb35c", "#f58220", "#a85513"],
      qlikRed: ["#ffd1d1", "#ff8a8a", "#dc2626", "#8f1d1d"],
      gray: ["#e5e7eb", "#9ca3af", "#4b5563", "#111827"]
    };

    return schemes[scheme] || fallback;
  }

  function stringHash(value) {
    var hash = 0;
    var text = String(value || "");
    for (var i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  function buildDiscreteColor(words, colors, keepColors) {
    if (!colors || !colors.length) {
      colors = ["#4477aa"];
    }

    return function (d, i) {
      if (keepColors) {
        return colors[stringHash(d.key || d.text) % colors.length];
      }
      return colors[i % colors.length];
    };
  }

  function buildColorScale(words, colors) {
    var minValue = d3.min(words, function (d) { return d.value; });
    var maxValue = d3.max(words, function (d) { return d.value; });

    if (!colors || !colors.length) {
      colors = ["#2563eb"];
    }

    if (colors.length === 1 || minValue === maxValue) {
      return function () { return colors[0]; };
    }

    return d3.scaleLinear()
      .domain(colors.map(function (_, index) {
        return minValue + ((maxValue - minValue) * index / (colors.length - 1));
      }))
      .range(colors);
  }

  return {
    definition: {
      type: "items",
      component: "accordion",
      items: {
        dimensions: {
          uses: "dimensions",
          min: 1,
          max: 1
        },
        measures: {
          uses: "measures",
          min: 1,
          max: 1
        },
        appearance: {
          uses: "settings",
          items: {
            minWordLength: {
              ref: "props.minWordLength",
              label: "Quantidade mínima de caracteres",
              type: "integer",
              defaultValue: 3
            },
            minFontSize: {
              ref: "props.minFontSize",
              label: "Fonte mínima",
              type: "integer",
              defaultValue: 14
            },
            maxFontSize: {
              ref: "props.maxFontSize",
              label: "Fonte máxima",
              type: "integer",
              defaultValue: 60
            },
            maxWords: {
              ref: "props.maxWords",
              label: "Quantidade máxima de palavras",
              type: "integer",
              defaultValue: 100
            },
            colorsSection: {
              type: "items",
              label: "Cores",
              items: {
                colorBy: {
                  ref: "props.colorBy",
                  label: "",
                  type: "string",
                  component: "dropdown",
                  options: [
                    { value: "dimension", label: "Por dimensão" },
                    { value: "measure", label: "Por medida" },
                    { value: "single", label: "Cor única" }
                  ],
                  defaultValue: "dimension"
                },
                dimensionInfo: {
                  component: "text",
                  label: "Selecionar dimensão: dimensão principal da nuvem"
                },
                colorLabel: {
                  ref: "props.colorLabel",
                  label: "Rótulo",
                  type: "string",
                  expression: "optional",
                  defaultValue: "Dimensão"
                },
                keepColors: {
                  ref: "props.keepColors",
                  label: "Manter cores",
                  type: "boolean",
                  component: "switch",
                  options: [{ value: true, label: "Ligado" }, { value: false, label: "Desligado" }],
                  defaultValue: true
                },
                colorMode: {
                  ref: "props.colorMode",
                  label: "Cores",
                  type: "string",
                  component: "buttongroup",
                  options: [
                    { value: "auto", label: "Automático" },
                    { value: "custom", label: "Personalizado" }
                  ],
                  defaultValue: "auto"
                },
                paletteHelp: {
                  component: "text",
                  label: "No modo Personalizado, selecione as cores pela paleta do Qlik. Elas serão usadas como esquema de cores da nuvem."
                },
                paletteColor1: {
                  ref: "props.paletteColor1",
                  label: "Cor 1",
                  type: "object",
                  component: "color-picker",
                  defaultValue: { color: "#4477aa" }
                },
                paletteColor2: {
                  ref: "props.paletteColor2",
                  label: "Cor 2",
                  type: "object",
                  component: "color-picker",
                  defaultValue: { color: "#7d8cc4" }
                },
                paletteColor3: {
                  ref: "props.paletteColor3",
                  label: "Cor 3",
                  type: "object",
                  component: "color-picker",
                  defaultValue: { color: "#dce4ff" }
                },
                paletteColor4: {
                  ref: "props.paletteColor4",
                  label: "Cor 4",
                  type: "object",
                  component: "color-picker",
                  defaultValue: { color: "#ffe082" }
                },
                paletteColor5: {
                  ref: "props.paletteColor5",
                  label: "Cor 5",
                  type: "object",
                  component: "color-picker",
                  defaultValue: { color: "#ffb300" }
                },
                paletteColor6: {
                  ref: "props.paletteColor6",
                  label: "Cor 6",
                  type: "object",
                  component: "color-picker",
                  defaultValue: { color: "#ff7f0e" }
                },
                paletteColor7: {
                  ref: "props.paletteColor7",
                  label: "Cor 7",
                  type: "object",
                  component: "color-picker",
                  defaultValue: { color: "#e31a1c" }
                },
                singleColor: {
                  ref: "props.singleColor",
                  label: "Cor única",
                  type: "object",
                  component: "color-picker",
                  defaultValue: { color: "#4477aa" }
                }
              }
            }
          }
        }
      }
    },

    initialProperties: {
      qHyperCubeDef: {
        qDimensions: [],
        qMeasures: [],
        qInitialDataFetch: [{
          qWidth: 2,
          qHeight: 5000
        }]
      },
      props: {
        minWordLength: 3,
        minFontSize: 14,
        maxFontSize: 60,
        maxWords: 100,
        colorBy: "dimension",
        colorLabel: "Dimensão",
        keepColors: true,
        colorMode: "auto",
        paletteColor1: { color: "#4477aa" },
        paletteColor2: { color: "#7d8cc4" },
        paletteColor3: { color: "#dce4ff" },
        paletteColor4: { color: "#ffe082" },
        paletteColor5: { color: "#ffb300" },
        paletteColor6: { color: "#ff7f0e" },
        paletteColor7: { color: "#e31a1c" },
        singleColor: { color: "#4477aa" }
      }
    },

    paint: function ($element, layout) {
      var self = this;
      $element.empty();

      var rendered = false;
      function safeRender(theme) {
        if (rendered) {
          return;
        }
        rendered = true;
        render(theme || null);
      }

      try {
        if (qlik && qlik.theme && typeof qlik.theme.getApplied === "function") {
          qlik.theme.getApplied().then(function (theme) {
            safeRender(theme);
          }, function () {
            safeRender(null);
          });
        } else {
          safeRender(null);
        }
      } catch (e) {
        safeRender(null);
      }

      function render(theme) {
        var dataPages = layout.qHyperCube && layout.qHyperCube.qDataPages;
        var matrix = dataPages && dataPages[0] && dataPages[0].qMatrix;
        var props = layout.props || {};

        var minLength = Number(props.minWordLength) || 3;
        var minFont = Number(props.minFontSize) || 14;
        var maxFont = Number(props.maxFontSize) || 60;
        var maxWords = Number(props.maxWords) || 100;
        var colorBy = props.colorBy || "dimension";
        var keepColors = props.keepColors !== false;
        var colorMode = props.colorMode || "auto";
        var fallbackColors = ["#4477aa", "#7d8cc4", "#dce4ff", "#ffe082", "#ffb300", "#ff7f0e", "#e31a1c"];
        var singleColor = getColorPickerValue(props.singleColor, "#4477aa");

        var width = Math.max($element.width() || 1, 1);
        var height = Math.max($element.height() || 1, 1);

        if (!matrix || !matrix.length) {
          $element.html('<div class="word-cloud-root word-cloud-empty">Sem dados para exibir.</div>');
          return;
        }

        var stopWords = {
          de: true, da: true, do: true, das: true, dos: true,
          a: true, o: true, e: true, em: true, para: true,
          com: true, um: true, uma: true, os: true, as: true,
          na: true, no: true, nos: true, nas: true
        };

        var wordsMap = {};
        var displayMap = {};
        var elementNumbersMap = {};

        matrix.forEach(function (row) {
          var dimCell = row[0] || {};
          var measureCell = row[1] || {};
          var text = dimCell.qText || "";
          var elemNumber = dimCell.qElemNumber;
          var measure = typeof measureCell.qNum === "number" && !isNaN(measureCell.qNum)
            ? measureCell.qNum
            : 1;

          text.split(/\s+/).forEach(function (rawWord) {
            var cleanWord = normalizeWord(rawWord);
            var displayWord = cleanDisplayWord(rawWord);

            if (cleanWord.length >= minLength && !stopWords[cleanWord]) {
              wordsMap[cleanWord] = (wordsMap[cleanWord] || 0) + measure;

              if (!displayMap[cleanWord]) {
                displayMap[cleanWord] = displayWord || cleanWord;
              }

              if (typeof elemNumber === "number" && elemNumber >= 0) {
                if (!elementNumbersMap[cleanWord]) {
                  elementNumbersMap[cleanWord] = {};
                }
                elementNumbersMap[cleanWord][elemNumber] = true;
              }
            }
          });
        });

        var words = Object.keys(wordsMap).map(function (key) {
          return {
            key: key,
            text: displayMap[key] || key,
            value: wordsMap[key],
            elemNumbers: Object.keys(elementNumbersMap[key] || {}).map(function (value) {
              return Number(value);
            })
          };
        });

        words = words
          .sort(function (a, b) { return b.value - a.value; })
          .slice(0, maxWords);

        if (!words.length) {
          $element.html('<div class="word-cloud-root word-cloud-empty">Nenhuma palavra atende aos filtros.</div>');
          return;
        }

        var minValue = d3.min(words, function (d) { return d.value; });
        var maxValue = d3.max(words, function (d) { return d.value; });

        var fontScale = d3.scaleLinear()
          .domain(minValue === maxValue ? [0, maxValue] : [minValue, maxValue])
          .range([minFont, maxFont]);

        var colors = colorMode === "custom"
          ? getPaletteFromProps(props, fallbackColors)
          : getThemeColors(theme, getPresetColors("standard", fallbackColors), 0);

        var colorScale = colorBy === "single"
          ? function () { return singleColor; }
          : colorBy === "measure"
            ? buildColorScale(words, colors)
            : buildDiscreteColor(words, colors, keepColors);

        cloud()
          .size([width, height])
          .words(words.map(function (d) {
            return {
              key: d.key,
              text: d.text,
              size: fontScale(d.value),
              value: d.value,
              elemNumbers: d.elemNumbers
            };
          }))
          .padding(5)
          .rotate(function () { return 0; })
          .font("Arial")
          .fontSize(function (d) { return d.size; })
          .on("end", draw)
          .start();

        function draw(cloudWords) {
          var root = d3.select($element[0])
            .append("div")
            .attr("class", "word-cloud-root");

          var tooltip = root
            .append("div")
            .attr("class", "word-cloud-tooltip")
            .style("opacity", 0);

          var svg = root
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", "0 0 " + width + " " + height)
            .attr("preserveAspectRatio", "xMidYMid meet");

          var zoomLayer = svg.append("g")
            .attr("class", "word-cloud-zoom-layer");

          var wordsLayer = zoomLayer.append("g")
            .attr("class", "word-cloud-words-layer")
            .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

          var currentZoom = 1;
          var translateX = 0;
          var translateY = 0;

          function applyZoom() {
            zoomLayer.attr("transform", "translate(" + translateX + "," + translateY + ") scale(" + currentZoom + ")");
          }

          svg.on("wheel", function () {
            var event = d3.event;
            if (!event) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();

            var oldZoom = currentZoom;
            var direction = event.deltaY > 0 ? -1 : 1;
            var factor = direction > 0 ? 1.12 : 0.89;
            currentZoom = Math.max(0.4, Math.min(5, currentZoom * factor));

            var pointer = d3.mouse(svg.node());
            translateX = pointer[0] - (pointer[0] - translateX) * (currentZoom / oldZoom);
            translateY = pointer[1] - (pointer[1] - translateY) * (currentZoom / oldZoom);

            applyZoom();
          });

          wordsLayer
            .selectAll("text")
            .data(cloudWords)
            .enter()
            .append("text")
            .attr("class", "word-cloud-word")
            .style("font-size", function (d) { return d.size + "px"; })
            .style("font-family", "Arial")
            .style("font-weight", "700")
            .style("fill", function (d, i) { return colorBy === "measure" ? colorScale(d.value) : colorScale(d, i); })
            .style("cursor", "pointer")
            .attr("text-anchor", "middle")
            .attr("transform", function (d) {
              return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
            })
            .text(function (d) { return d.text; })
            .on("mousemove", function (d) {
              var mouse = d3.mouse(root.node());
              tooltip
                .html("<strong>" + escapeHtml(d.text) + "</strong><br>Quantidade: " + formatNumber(d.value))
                .style("left", (mouse[0] + 12) + "px")
                .style("top", (mouse[1] + 12) + "px")
                .style("opacity", 1);
            })
            .on("mouseleave", function () {
              tooltip.style("opacity", 0);
            })
            .on("click", function (d) {
              tooltip.style("opacity", 0);

              if (d.elemNumbers && d.elemNumbers.length && self.backendApi) {
                self.backendApi.selectValues(0, d.elemNumbers, true);
              }
            });
        }
      }
    }
  };
});
