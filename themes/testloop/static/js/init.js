$(function () {
  sliders();
  contactForm()
});

// Ajax contact
function contactForm () {
  var form = $('.contact-form');
  form.submit(function () {
    $this = $(this);
    $.post($(this).attr('action'),
      $this.serialize(),
      function () {
        $this[0].reset();
        $('#contact-message')
        .html('<div class="alert alert-success" role="alert"><button type="button" class="close" data-dismiss="alert"><span aria-hidden="true">×</span><span class="sr-only">Close</span></button>Thank you for getting in touch. We will get back to you soon!</div>')
        .fadeIn()
      }
      , 'json');
    return false
  })
}

function sliders () {
  if ($('.owl-carousel').length) {
    $('.customers').owlCarousel({
      items: 4,
      itemsDesktopSmall: [990, 4],
      itemsTablet: [768, 2],
      itemsMobile: [480, 1]
    });

    $('.testimonials').owlCarousel({
      items: 4,
      itemsDesktopSmall: [1024, 2],
      itemsTablet: [768, 2],
      itemsMobile: [480, 1]
    });

    $('.homepage').owlCarousel({
      navigation: false,
      navigationText: ['<i class="fa fa-angle-left"></i>', '<i class="fa fa-angle-right"></i>'],
      slideSpeed: 2000,
      paginationSpeed: 1000,
      autoPlay: true,
      stopOnHover: true,
      singleItem: true,
      lazyLoad: false,
      addClassActive: true
    })
  }
}