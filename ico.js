/*jslint white: false plusplus: false onevar: false browser: true evil: true*/
/*global window: true*/

(function(global) {
  var Ico = {
    VERSION: '0.2.1',
    round: function(num, dec) {
      var result = Math.round(num * Math.pow(10, dec)) / Math.pow(10,dec);
      return result;
    }
  };

  function getStyle(el, styleProp) {
    var style;
    if (el.currentStyle) {
      style = el.currentStyle[styleProp];
    } else if (window.getComputedStyle) {
      style = document.defaultView.getComputedStyle(el, null).getPropertyValue(styleProp);
    }
    if (style && style.length === 0) {
      style = null;
    }
    return style;
  }

  Array.prototype.sum = function() {
    for (var i = 0, sum = 0; i < this.length; sum += this[i++]) {}
    return sum;
  };

  if (typeof Array.prototype.max === 'undefined') {
    Array.prototype.max = function() {
      return Math.max.apply({}, this);
    };
  }

  if (typeof Array.prototype.min === 'undefined') {
    Array.prototype.min = function() {
      return Math.min.apply({}, this);
    };
  }

  Array.prototype.mean = function() {
    return this.sum() / this.length;
  };

  Array.prototype.variance = function() {
    var mean = this.mean(),
        variance = 0;
    for (var i = 0; i < this.length; i++) {
      variance += Math.pow(this[i] - mean, 2);
    }
    return variance / (this.length - 1);
  };

  Array.prototype.standard_deviation = function() {
    return Math.sqrt(this.variance());
  };

  if (typeof Object.extend === 'undefined') {
    Object.extend = function(destination, source) {
      for (var property in source) {
        if (source.hasOwnProperty(property)) {
          destination[property] = source[property];
        }
      }
      return destination;
    };
  }

  Ico.Normaliser = function(data, options) {
    this.options = {
      start_value: null
    };

    if (typeof options !== 'undefined') {
      this.options = options;
    }

    this.min = data.min();
    this.max = data.max();
    this.standard_deviation = data.standard_deviation();
    this.range = 0;
    this.step = this.labelStep(this.max - this.min);
    this.start_value = this.calculateStart();
    this.process();
  };

  Ico.Normaliser.prototype = {
    calculateStart: function() {
      var min = this.options.start_value != null && this.min >= 0 ? this.options.start_value : this.min,
          start_value = this.round(min, 1);

      /* This is a boundary condition */
      if (this.min > 0 && start_value > this.min) {
        return 0;
      }

      return start_value;
    },

    /* Given a value, this method rounds it to the nearest good value for an origin */
    round: function(value, offset) {
      offset = offset || 1;
      var roundedValue = value;

      if (this.standard_deviation > 0.1) {
        var multiplier = Math.pow(10, -offset);
        roundedValue = Math.round(value * multiplier) / multiplier;

        if (roundedValue > this.min) {
          return this.round(value - this.step);
        }
      }
      return roundedValue;
    },

    process: function() {
      this.range = this.max - this.start_value;
      this.step = this.labelStep(this.range);
    },

    labelStep: function(value) {
      return Math.pow(10, Math.round((Math.log(value) / Math.LN10)) - 1);
    }
  };

  Ico.Base = {
    normaliseData: function(data) {
      var values = [],
          i      = 0;
      for (i = 0; i < data.length; i++) {
        values.push(this.normalise(data[i]));
      }
      return values;
    },

    /* TODO: Unit test */
    flatten: function(data) {
      var flat_data = [];

      if (typeof data.length === 'undefined') {
        if (typeof data === 'object') {
          for (var key in data) {
            if (data.hasOwnProperty(key)) {
              flat_data = flat_data.concat(this.flatten(data[key]));
            }
          }
        } else {
          return [];
        }
      }

      for (var i = 0; i < data.length; i++) {
        if (typeof data[i].length === 'number') {
          flat_data = flat_data.concat(this.flatten(data[i]));
        } else {
          flat_data.push(data[i]);
        }
      }
      return flat_data;
    },

    makeRange: function(start, end) {
      var values = [], i;
      for (i = start; i < end; i++) {
        values.push(i);
      }
      return values;
    }
  };

  Ico.SparkLine = function() { this.initialize.apply(this, arguments); };
  Ico.SparkLine.prototype = {
    initialize: function(element, data, options) {
      this.element = element;
      this.data = data;

      this.options = {
        width:             parseInt(getStyle(element, 'width'), 10),
        height:            parseInt(getStyle(element, 'height'), 10),
        highlight:         false,
        background_colour: getStyle(element, 'backgroundColor') || '#ffffff',
        colour:            '#036'
      };
      Object.extend(this.options, options || { });

      this.step = this.calculateStep();
      this.paper = Raphael(this.element, this.options.width, this.options.height);

      if (this.options.acceptable_range) {
        this.background = this.paper.rect(0, this.options.height - this.normalise(this.options.acceptable_range[1]),
                                             this.options.width,
                                             this.options.height - this.normalise(this.options.acceptable_range[0]));
      } else {
        this.background = this.paper.rect(0, 0, this.options.width, this.options.height);
      }

      this.background.attr({fill: this.options.background_colour, stroke: 'none' });
      this.draw();
    },

    calculateStep: function() {
      return this.options.width / (this.data.length - 1);
    },

    normalise: function(value) {
      return (this.options.height / this.data.max()) * value;
    },
    
    draw: function() {
      var data = this.normaliseData(this.data);
      this.drawLines('', this.options.colour, data);
      
      if (this.options.highlight) {
        this.showHighlight(data);
      }
    },
    
    drawLines: function(label, colour, data) {
      var pathString = '',
          x = 0,
          values = data.slice(1),
          i = 0;

      pathString = 'M0,' + (this.options.height - data[0]);
      this.lastPoint = { x: 0, y: this.options.height - data[0] };
      for (i = 0; i < data.length; i++) {
        x = x + this.step;
        pathString += 'L' + x +',' + (this.options.height - data[i]);
      }
      this.paper.path(pathString).attr({stroke: colour});
    },
    
    showHighlight: function(data) {
      var size = 2,
          x = this.options.width - size,
          i = this.options.highlight.index || data.length - 1,
          y = data[i] + (Math.round(size / 2));

      if (typeof(this.options.highlight.index) !== 'undefined') {
        x = this.step * this.options.highlight.index;
      }

      var circle = this.paper.circle(x, this.options.height - y, size);
      circle.attr({ stroke: false, fill: this.options.highlight.colour});
    }
  };
  Object.extend(Ico.SparkLine.prototype, Ico.Base);

  Ico.SparkBar = function() { this.initialize.apply(this, arguments); };
  Object.extend(Ico.SparkBar.prototype, Ico.SparkLine.prototype);
  Object.extend(Ico.SparkBar.prototype, {
    calculateStep: function() {
      return this.options.width / this.data.length;
    },

    drawLines: function(label, colour, data) {
      var width = this.step > 2 ? this.step - 1 : this.step,
          x = width,
          pathString  = '',
          i = 0;
      for (i = 0; i < data.length; i++) {
        pathString += 'M' + x + ',' + (this.options.height - data[i]);
        pathString += 'L' + x + ',' + this.options.height;
        x = x + this.step;
      }
      this.paper.path(pathString).attr({ stroke: colour, 'stroke-width': width });
    }
  });

  Ico.BaseGraph = function() { this.initialize.apply(this, arguments); };
  Object.extend(Ico.BaseGraph.prototype, Ico.Base);
  Object.extend(Ico.BaseGraph.prototype, {
    /* Data is expected to be a list, the list names are used as labels */
    initialize: function(element, data, options) {
      this.element = element;

      this.data_sets = this.buildDataSets(data, options);
      this.flat_data = this.flatten(data);

      this.normaliser = new Ico.Normaliser(this.flat_data, this.normaliserOptions());
      this.label_step = this.normaliser.step;
      this.range = this.normaliser.range;
      this.start_value = this.normaliser.start_value;
      this.data_size = this.longestDataSetLength();

      /* If one colour is specified, map it to a compatible set */
      if (options && options.colour) {
        options.colours = {};
        for (var key in this.data_sets) {
          options.colours[key] = options.colour;
        }
      }

      this.options = {
        width:                  parseInt(getStyle(element, 'width'), 10),
        height:                 parseInt(getStyle(element, 'height'), 10),
        labels:                 this.makeRange(1, this.data_size),    // Label data
        plot_padding:           10,                                   // Padding for the graph line/bar plots
        font_size:              10,                                   // Label font size
        show_horizontal_labels: true,
        show_vertical_labels:   true,
        background_colour:      getStyle(element, 'backgroundColor') || '#ffffff',
        label_colour:           '#666',                               // Label text colour
        markers:                false,                                // false, circle
        marker_size:            5,
        meanline:               false,
        grid:                   false,
        grid_colour:            '#ccc',
        y_padding_top:          20,
        draw:                   true
      };
      Object.extend(this.options, this.chartDefaults() || { });
      Object.extend(this.options, options || { });

      /* Padding around the graph area to make room for labels */
      this.x_padding_left = 10 + this.paddingLeftOffset();
      this.x_padding_right = 20;
      this.x_padding = this.x_padding_left + this.x_padding_right;
      this.y_padding_top = this.options.y_padding_top;
      this.y_padding_bottom = 20 + this.paddingBottomOffset();
      this.y_padding = this.y_padding_top + this.y_padding_bottom;
      
      this.graph_width = this.options.width - (this.x_padding);
      this.graph_height = this.options.height - (this.y_padding);

      this.step = this.calculateStep();

      /* Calculate how many labels are required */
      this.y_label_count = Math.ceil(this.range / this.label_step);
      if ((this.normaliser.min + (this.y_label_count * this.normaliser.step)) < this.normaliser.max) {
        this.y_label_count += 1;
      }
      this.value_labels = this.makeValueLabels(this.y_label_count);
      this.top_value = this.value_labels[this.value_labels.length - 1];

      /* Grid control options */
      this.grid_start_offset = -1;

      /* Drawing */
      if (this.options.draw) {
        if (typeof this.options.colours === 'undefined') {
          this.options.colours = this.makeRandomColours();
        }

        this.paper = Raphael(this.element, this.options.width, this.options.height);
        this.background = this.paper.rect(this.x_padding_left, this.y_padding_top, this.graph_width, this.graph_height);
        this.background.attr({fill: this.options.background_colour, stroke: 'none' });

        if (this.options.meanline === true) {
          this.options.meanline = { 'stroke-width': '2px', stroke: '#BBBBBB' };
        }

        this.setChartSpecificOptions();
        this.lastPoint = { x: 0, y: 0 };
        this.draw();
      }
    },

    buildDataSets: function(data, options) {
      return (typeof data.length !== 'undefined') ? { 'one': data } : data;
    },

    normaliserOptions: function() {
      return {};
    },
    
    chartDefaults: function() {
      /* Define in child class */
      return {};
    },
   
    drawPlot: function(index, pathString, x, y, colour) {
      /* Define in child class */
    },
    
    drawHorizontalLabels: function() {
      /* Define in child class */
    },

    calculateStep: function() {
      /* Define in child classes */
    },
    
    makeRandomColours: function() {
      var colours = {};
      for (var key in this.data_sets) {
        colours[key] = Raphael.hsb2rgb(Math.random(), 1, .75).hex;
      }
      return colours;
    },
    
    longestDataSetLength: function() {
      var length = 0;
      for (var key in this.data_sets) {
        if (this.data_sets.hasOwnProperty(key)) {
          length = this.data_sets[key].length > length ? this.data_sets[key].length : length;
        }
      }
      return length;
    },
    
    roundValue: function(value, length) {
      var multiplier = Math.pow(10, length);
      value *= multiplier;
      value = Math.round(value) / multiplier;
      return value;
    },
    
    roundValues: function(data, length) {
      var roundedData = [];
      for (var i = 0; i < data.length; i++) {
        roundedData.push(this.roundValue(data[i], length));
      }
      return roundedData;
    },
    
    paddingLeftOffset: function() {
      /* Find the longest label and multiply it by the font size */
      var data = this.roundValues(this.flat_data, 2),
          longest_label_length = 0;

      longest_label_length = data.sort(function(a, b) { 
        return a.toString().length < b.toString().length;
      })[0].toString().length;

      longest_label_length = longest_label_length > 2 ? longest_label_length - 1 : longest_label_length;
      return longest_label_length * this.options.font_size;
    },
    
    paddingBottomOffset: function() {
      /* Find the longest label and multiply it by the font size */
      return this.options.font_size;
    },
    
    normalise: function(value) {
      var total = this.start_value === 0 ? this.top_value : this.range;
      return ((value / total) * (this.graph_height));
    },
    
    draw: function() {
      if (this.options.grid) {
        this.drawGrid();
      }

      if (this.options.meanline) {
        this.drawMeanLine(this.normaliseData(this.flat_data));
      }

      this.drawAxis();
      
      if (this.options.show_vertical_labels) {
        this.drawVerticalLabels();
      }
      
      if (this.options.show_horizontal_labels) {
        this.drawHorizontalLabels();
      }

      for (var key in this.data_sets) {
        if (this.data_sets.hasOwnProperty(key)) {
          var data = this.data_sets[key];
          this.drawLines(key, this.options.colours[key], this.normaliseData(data));
        }
      }
      
      if (this.start_value != 0) {
        this.drawFocusHint();
      }
    },

    drawGrid: function() {
      var pathString = '', i;

      if (this.options.show_vertical_labels) {
        var y = this.graph_height + this.y_padding_top;
        for (i = 0; i < this.y_label_count; i++) {
          y = y - (this.graph_height / this.y_label_count);
          pathString += 'M' + this.x_padding_left + ',' + y;
          pathString += 'L' + (this.x_padding_left + this.graph_width) + ',' + y;
        }
      }
   
      if (this.options.show_horizontal_labels) {
        var x = this.x_padding_left + this.options.plot_padding + this.grid_start_offset,
            x_labels = this.options.labels.length;

        for (i = 0; i < x_labels; i++) {
          pathString += 'M' + x + ',' + this.y_padding_top;
          pathString += 'L' + x +',' + (this.y_padding_top + this.graph_height);
          x = x + this.step;
        }

        x = x - this.options.plot_padding - 1;
        pathString += 'M' + x + ',' + this.y_padding_top;
        pathString += 'L' + x + ',' + (this.y_padding_top + this.graph_height);
      }

      this.paper.path(pathString).attr({ stroke: this.options.grid_colour, 'stroke-width': '1px'});
    },

    drawLines: function(label, colour, data) {
      var coords = this.calculateCoords(data),
          pathString = '';

      for (var i = 0; i < coords.length; i++) {
        var x = coords[i][0],
            y = coords[i][1];
        pathString = this.drawPlot(i, pathString, x, y, colour);
      }

      this.paper.path(pathString).attr({stroke: colour, 'stroke-width': '3px'});
    },

    calculateCoords: function(data) {
      var x = this.x_padding_left + this.options.plot_padding - this.step,
          y_offset = (this.graph_height + this.y_padding_top) + this.normalise(this.start_value),
          y = 0,
          coords = [];
      for (var i = 0; i < data.length; i++) {
        y = y_offset - data[i];
        x = x + this.step;
        coords.push([x, y]);
      }
      return coords;
    },

    drawFocusHint: function() {
      var length = 5,
          x = this.x_padding_left + (length / 2) - 1,
          y = this.options.height - this.y_padding_bottom,
          pathString = '';

      pathString += 'M' + x + ',' + y;
      pathString += 'L' + (x - length) + ',' + (y - length);
      pathString += 'M' + x + ',' + (y - length);
      pathString += 'L' + (x - length) + ',' + (y - (length * 2));
      this.paper.path(pathString).attr({stroke: this.options.label_colour, 'stroke-width': 2});
    },

    drawMeanLine: function(data) {
      var offset = data.sum() / data.length,
          pathString = '';
   
      pathString += 'M' + (this.x_padding_left - 1) + ',' + (this.options.height - this.y_padding_bottom - offset);
      pathString += 'L' + (this.graph_width + this.x_padding_left) + ',' + (this.options.height - this.y_padding_bottom - offset);
      this.paper.path(pathString).attr(this.options.meanline);
    },

    drawAxis: function() {
      var pathString = '';

      pathString += 'M' + (this.x_padding_left - 1) + ',' + (this.options.height - this.y_padding_bottom);
      pathString += 'L' + (this.graph_width + this.x_padding_left) + ',' + (this.options.height - this.y_padding_bottom); 
      pathString += 'M' + (this.x_padding_left - 1) + ',' + (this.options.height - this.y_padding_bottom); 
      pathString += 'L' + (this.x_padding_left - 1) + ',' + (this.y_padding_top);

      this.paper.path(pathString).attr({ stroke: this.options.label_colour });
    },
    
    makeValueLabels: function(steps) {
      var step = this.label_step,
          label = this.start_value,
          labels = [];

      for (var i = 0; i < steps; i++) {
        label = this.roundValue((label + step), 2);
        labels.push(label);
      }
      return labels;
    },
   
    /* Axis label markers */
    drawMarkers: function(labels, direction, step, start_offset, font_offsets, extra_font_options) {
      function x_offset(value) {
        return value * direction[0];
      }
      
      function y_offset(value) {
        return value * direction[1];
      }
      
      /* Start at the origin */
      var x = this.x_padding_left - 1 + x_offset(start_offset),
          y = this.options.height - this.y_padding_bottom + y_offset(start_offset),
          pathString = '',
          font_options = {"font": this.options.font_size + 'px "Arial"', stroke: "none", fill: "#000"};
      Object.extend(font_options, extra_font_options || {});
      
      for (var i = 0; i < labels.length; i++) {
        pathString += 'M' + x + ',' + y;
        if (labels[i] != null && (labels[i] + '').length > 0) {
          pathString += 'L' + (x + y_offset(5)) + ',' + (y + x_offset(5));
          this.paper.text(x + font_offsets[0], y - font_offsets[1], labels[i]).attr(font_options).toFront();
        }
        x = x + x_offset(step);
        y = y + y_offset(step);
      }

      this.paper.path(pathString).attr({ stroke: this.options.label_colour });
    },
    
    drawVerticalLabels: function() {
      var y_step = this.graph_height / this.y_label_count; 
      this.drawMarkers(this.value_labels, [0, -1], y_step, y_step, [-8, -2], { "text-anchor": 'end' });
    },
    
    drawHorizontalLabels: function() {
      this.drawMarkers(this.options.labels, [1, 0], this.step, this.options.plot_padding, [0, (this.options.font_size + 7) * -1]);
    }
  });

  Ico.LineGraph = function() { this.initialize.apply(this, arguments); };
  Object.extend(Ico.LineGraph.prototype, Ico.BaseGraph.prototype);
  Object.extend(Ico.LineGraph.prototype, {
    normalise: function(value) {
      var total = this.start_value === 0 ? this.top_value : this.top_value - this.start_value;
      return ((value / total) * (this.graph_height));
    },

    chartDefaults: function() {
      return { plot_padding: 10 };
    },

    setChartSpecificOptions: function() {
      if (typeof this.options.curve_amount === 'undefined') {
        this.options.curve_amount = 10;
      }
    },
    
    calculateStep: function() {
      return (this.graph_width - (this.options.plot_padding * 2)) / (this.data_size - 1);
    },

    startPlot: function(pathString, x, y, colour) {
      this.lastPoint = { x: x, y: y }; 
      return pathString + 'M' + x + ',' + y;
    },

    drawPlot: function(index, pathString, x, y, colour) {
      var w = this.options.curve_amount;

      if (this.options.markers === 'circle') {
        var circle = this.paper.circle(x, y, this.options.marker_size);
        circle.attr({ 'stroke-width': '1px', stroke: this.options.background_colour, fill: colour });
      }
      
      if (index == 0) {
        return this.startPlot(pathString, x, y, colour);
      }

      if (w) {
        pathString += ['C', this.lastPoint.x + w, this.lastPoint.y, x - w, y, x, y];
      } else {
        pathString += 'L' + x + ',' + y;
      }

      this.lastPoint = { x: x, y: y };
      return pathString;
    }
  });

  Ico.BarGraph = function() { this.initialize.apply(this, arguments); };
  Object.extend(Ico.BarGraph.prototype, Ico.BaseGraph.prototype);
  Object.extend(Ico.BarGraph.prototype, {
    chartDefaults: function() {
      return { plot_padding: 0 };
    },

    normaliserOptions: function() {
      return { start_value: 0 };
    },
    
    setChartSpecificOptions: function() {
      this.bar_padding = 5;
      this.bar_width = this.calculateBarWidth();
      this.options.plot_padding = (this.bar_width / 2);
      this.step = this.calculateStep();
      this.grid_start_offset = this.bar_padding - 1;
      this.start_y = this.options.height - this.y_padding_bottom;
    },

    calculateBarWidth: function() {
      return (this.graph_width / this.data_size) - this.bar_padding;
    },
    
    calculateStep: function() {
      return (this.graph_width - (this.options.plot_padding * 2) - (this.bar_padding * 2)) / (this.data_size - 1);
    },
   
    drawPlot: function(index, pathString, x, y, colour) {
      x = x + this.bar_padding;
      pathString += 'M' + x + ',' + this.start_y;
      pathString += 'L' + x + ',' + y;
      this.paper.path(pathString).attr({stroke: colour, 'stroke-width': this.bar_width + 'px'});
      pathString = '';
      x = x + this.step;
      pathString += 'M' + x + ',' + this.start_y;
      return pathString;
    },

    /* Change the standard options to correctly offset against the bars */
    drawHorizontalLabels: function() {
      var x_start = this.bar_padding + this.options.plot_padding;
      this.drawMarkers(this.options.labels, [1, 0], this.step, x_start, [0, (this.options.font_size + 7) * -1]);
    }
  });

  Ico.HorizontalBarGraph = function() { this.initialize.apply(this, arguments); };
  Object.extend(Ico.HorizontalBarGraph.prototype, Ico.BaseGraph.prototype);
  Object.extend(Ico.HorizontalBarGraph.prototype, {
    setChartSpecificOptions: function() {
      // Approximate the width required by the labels
      this.x_padding_left = 20 + this.longestLabel() * (this.options.font_size / 2);
      this.bar_padding = 5;
      this.bar_width = this.calculateBarHeight();
      this.options.plot_padding = 0;
      this.step = this.calculateStep();
    },

    normalise: function(value) {
      var offset = this.x_padding_left;
      return ((value / this.range) * (this.graph_width - offset));
    },

    longestLabel: function() {
      return this.options.labels.sort(function(a, b) { return a.toString().length < b.toString().length; })[0].toString().length;
    },

    /* Height */
    calculateBarHeight: function() {
      return (this.graph_height / this.data_size) - this.bar_padding;
    },
    
    calculateStep: function() {
      return (this.graph_height - (this.options.plot_padding * 2)) / (this.data_size);
    },
    
    drawLines: function(label, colour, data) {
      var x = this.x_padding_left + this.options.plot_padding,
          y = this.options.height - this.y_padding_bottom - (this.step / 2),
          pathString = 'M' + x + ',' + y,
          i;

      for (i = 0; i < data.length; i++) {
        pathString += 'L' + (x + data[i] - this.normalise(this.start_value)) + ',' + y;
        y = y - this.step;
        pathString += 'M' + x + ',' + y;
      }
      this.paper.path(pathString).attr({stroke: colour, 'stroke-width': this.bar_width + 'px'});
    },

    /* Horizontal version */
    drawFocusHint: function() {
      var length = 5,
          x = this.x_padding_left + (this.step * 2),
          y = this.options.height - this.y_padding_bottom,
          pathString = '';
      
      pathString += 'M' + x + ',' + y;
      pathString += 'L' + (x - length) + ',' + (y + length);
      pathString += 'M' + (x - length) + ',' + y;
      pathString += 'L' + (x - (length * 2)) + ',' + (y + length);
      this.paper.path(pathString).attr({stroke: this.options.label_colour, 'stroke-width': 2});
    },
    
    drawVerticalLabels: function() {
      var y_start = (this.step / 2) - this.options.plot_padding;
      this.drawMarkers(this.options.labels, [0, -1], this.step, y_start, [-8, -(this.options.font_size / 5)], { 'text-anchor': 'end' });
    },
    
    drawHorizontalLabels: function() {
      var x_step = this.graph_width / this.y_label_count,
          x_labels = this.makeValueLabels(this.y_label_count);
      this.drawMarkers(x_labels, [1, 0], x_step, x_step, [0, (this.options.font_size + 7) * -1]);
    }
  });

  global.Ico = Ico;
})(typeof window === 'undefined' ? this : window);
