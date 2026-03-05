import { extendTheme } from '@chakra-ui/react';

const theme = extendTheme({
  colors: {
    brand: {
      50: '#e0f2f3',
      100: '#b3e0e2',
      200: '#80cbd0',
      300: '#4db5be',
      400: '#26a5b0',
      500: '#015668', // Base Teal
      600: '#014d5d',
      700: '#01414f',
      800: '#013642',
      900: '#00222b',
    },
    accent: {
      50: '#f4f9e7',
      100: '#e4f1c3',
      200: '#d3e89c',
      300: '#c2df74',
      400: '#b5d856',
      500: '#a6ce39', // Base Lime
      600: '#97bc34',
      700: '#86a72e',
      800: '#759228',
      900: '#556a1d',
    },
  },
  components: {
    Button: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
    Tabs: {
      defaultProps: {
        colorScheme: 'brand',
      },
    },
  },
});

export default theme;
