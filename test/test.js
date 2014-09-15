describe('Leaflet.buffer', function(){
  beforeEach(function(){
    browser.ignoreSynchronization = true;
    browser.get('http://localhost:1234');
  });

  it('should add a button', function(){
    expect(element(by.css('.leaflet-draw-edit-buffer')).isPresent()).toBe(true);
  });
});
