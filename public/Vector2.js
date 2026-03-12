var Vector2 = function(x, y) {
    this.x = x || 0;
    this.y = y || 0;
};
Vector2.prototype = {
    add: function(v) { this.x += v.x; this.y += v.y; },
    mult: function(f) { this.x *= f; this.y *= f; }
};