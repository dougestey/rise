import Component from '@ember/component';
import { run } from '@ember/runloop';
import { get } from '@ember/object';
import ResizeAware from 'ember-resize/mixins/resize-aware';

// Import the D3 packages we want to use
import { select } from 'd3-selection';
import { scaleLinear } from 'd3-scale';
import { extent } from 'd3-array';
import { transition } from 'd3-transition';
import { easeCubicInOut } from 'd3-ease';

import { task, waitForProperty } from 'ember-concurrency';

export default Component.extend(ResizeAware, {

  tagName: 'svg',
  // classNames: ['awesome-d3-widget'],

  attributeBindings: ['width', 'height'],

  // Array of points to render as circles in a line, spaced by time.
  //  [ {value: Number, timestamp: Number } ];
  init() {
    this._super()
    this.data = []
  },

  debouncedDidResize(width, height) {
    this.set('width', width);
    this.set('height', height);

    this.drawRegions();
  },

  didInsertElement() {
    this._super(...arguments);

    let viewport = document.querySelector('.Gloss-viewport');

    this.set('width', viewport.clientWidth);
    this.set('height', viewport.clientHeight);
  },

  didReceiveAttrs() {
    // Schedule a call to our `drawRegions` method on Ember's "render" queue, which will
    // happen after the component has been placed in the DOM, and subsequently
    // each time data is changed.
    run.scheduleOnce('render', this, this.drawRegions)
  },

  _regionX(data, width) {
    return scaleLinear()
      .domain(extent(data.map(d => d.x)))
      .range([0, width])
  },

  _regionY(data, height) {
    return scaleLinear()
      .domain(extent(data.map(d => d.z)))
      .range([height, 0])
  },

  _systemX(data, width) {
    return scaleLinear()
      .domain(extent(data.map(d => d.x)))
      .range([0, width / 11])
  },

  _systemY(data, height) {
    return scaleLinear()
      .domain(extent(data.map(d => d.y)))
      .range([0, height / 13])
  },

  drawSystems: task(function * () {
    yield waitForProperty(this, 'systems.length', val => val !== 0);

    let data = get(this, 'systems');
    let regions = get(this, 'regions');
    let width = get(this, 'width') - 160;
    let height = get(this, 'height') - 160;

    for (let region of regions) {
      let plot = select(`[data-id="${region.id}"]`);
      let dataSlice = data.filterBy('region.id', region.id);

      let systems = plot.selectAll('circle').data(dataSlice);

      // Enter
      let enter = systems
        .enter()
        .append('circle')
          .attr('fill', '#3c9a95')
          .attr('opacity', 0.5)
          .attr('r', 1)
          .attr('data-id', d => d.id)
          .attr('data-name', d => d.name)
          .merge(systems)
            .attr('cy', d => this._systemY(dataSlice, height)(d.y))
            .attr('cx', d => this._systemX(dataSlice, width)(d.x))

      systems
        .exit()
        .remove();
    }

  }),

  drawRegions() {
    this.get('drawRegionsTask').perform();
  },

  drawRegionsTask: task(function * () {
    yield waitForProperty(this, 'regions.length', val => val !== 0);

    let data = get(this, 'regions');
    let width = get(this, 'width') - 160;
    let height = get(this, 'height') - 160;
    let centered;

    let plot = select(this.element)
      .append('g');

    let _selectRegion = (d) => {
      let x, y, k;

      if (d && centered !== d) {
        x = this._regionX(data, width)(d.x);
        y = this._regionY(data, height)(d.z);
        k = 5;
        centered = d;
      } else {
        x = width / 2;
        y = height / 2;
        k = 1;
        centered = null;
      }

      plot.selectAll('g')
        .classed('active', centered && function(d) { return d === centered; })
        .select('text')
          .attr('style', () => {
            return centered ? 'font-size: 4px' : 'font-size: 9px';
          });

      plot.selectAll('g')
        .selectAll('circle')
          .attr('r', () => {
            return centered ? 0.5 : 1;
          });

      plot
        .transition()
          .duration(750)
          .attr('transform', "translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
    };

    // Create a transition to use later
    let t = transition()
      .duration(250)
      .ease(easeCubicInOut)

    // UPDATE EXISTING
    let regions = plot
      .selectAll('g')
      .data(data)

    // Enter
    let enter = regions
      .enter()
      .append('g')
        .attr('class', 'Gloss-map--region')
        .attr('data-id', d => d.id)
        .attr('data-name', d => d.name)
        .attr('opacity', 0.7)
        .on('mouseover', function(d) {
          select(`[data-id="${d.id}"]`)
            .attr('opacity', 1)
            .selectAll('circle').attr('opacity', 0.9)
        })
        .on('mouseout', function(d) {
          select(`[data-id="${d.id}"]`)
            .attr('opacity', 0.7)
            .selectAll('circle').attr('opacity', 0.5)
        })
        .on('click', _selectRegion)          

    enter
      .append('text')
        .text(d => d.name)
          .attr('fill', '#d2fffd')
          .attr('style', 'font-size: 9px;')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')

    enter
      .merge(regions)
        .attr('transform', (d) => {
          return `translate(${this._regionX(data, width)(d.x)}, ${this._regionY(data, height)(d.z)})`
        })
        .select('text')
          .attr('x', function() {
            return this.parentNode.getBBox().width / 2
          })
          .attr('y', function() {
            return (this.parentNode.getBBox().height / 2) + 10
          })

    // EXIT
    regions
      .exit()
      .transition(t)
      .attr('r', 0)
      .remove()

    yield this.get('drawSystems').perform();
  }),
})