module Defaults

  ARTISTS_DIRECTORY = "#{Rails.root}/public/artwork/artists"
  ARTISTS_BUCKET_NAME = "art47-artists"

  ARTWORKS_BUCKET_NAME = "art47-artworks"
  USERS_DIRECTORY = "#{Rails.root}/public/users"
  
  NETWORK_TYPE = "TENSOR_FLOW"
  NETWORK_ID = "nn_DEFAULT_type_#{NETWORK_TYPE}"
  NETWORK_FILENAME = "neuralnetwork_#{NETWORK_TYPE}.net"
  NETWORKS_BUCKET_NAME = "art47-networks"
  NETWORK_DIRECTORY = "#{Rails.root}/neuralnetworks"
  NETWORK_NUM_INPUTS = 400
  NETWORK_HIDDEN_NEURONS = [ 100 ]
  NETWORK_TRAIN_EPOCHS = 10000
  NETWORK_TRAIN_ERRORS = 100
  NETWORK_TRAIN_MSE = 0.0001
  NETWORK_INPUT_TAGS = [    
    "acrylic paint",
    "adaptation",
    "alizarine red color",
    "amusement arcade",
    "architecture",
    "art gallery",
    "art studio",
    "art",
    "artwork",
    "bed",
    "black color",
    "black-and-white",
    "black and white",
    "brick red color",
    "building",
    "clothing",
    "crazy quilt",
    "densely-populated urban area",
    "design",
    "electrical device",
    "end",
    "fabric",
    "fauve painting",
    "flower",
    "flowering plant",
    "font",
    "food",
    "footwear",
    "graffiti",
    "gray color",
    "housing",
    "illustration",
    "line",
    "maroon color",
    "mode of transport",
    "modern art",
    "monochrome photography",
    "monochrome",
    "mosaic",
    "mural",
    "nature",
    "orchid",
    "painting",
    "pale yellow color",
    "pattern",
    "people",
    "person",
    "photograph",
    "photography",
    "pink",
    "plant",
    "promenade",
    "psychedelic art",
    "red",
    "reddish orange color",
    "room",
    "sitting",
    "snapshot",
    "stanhopea",
    "street art",
    "tapestry",
    "visual arts",
    "wall",
  ]

end