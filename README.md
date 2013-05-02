# compound-slugs

Slugs in CompoundJS.

## Usage

In `config/initializers/slugs.js`:

    module.exports = function(compound) {
        require('compound-slugs')(compound);
    };

In `application_controller.js`:

    before(function() {
        routeWithSlugs();
    });

compound-slugs will latch itself onto any routes with parameters whose corresponding model has a `slug` method. The fetched model object will be cached on `req` for further use.